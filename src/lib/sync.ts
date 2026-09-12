import { getSupabaseServerClient } from "./supabase";
import type { BrowsableItem } from "./catalog";
import { fetchKamisDailyPrices } from "./kamis/client";
import { normalizeToDailyPrices } from "./normalize";
import { addDays, toYyyymmdd } from "./date";

function yyyymmddToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export interface SyncItemResult {
  slug: string;
  itemId: string;
  unitLabel: string;
  rowsWritten: number;
}

// 품목 하나에 대해: KAMIS에서 가져와 정규화 → items/daily_prices에 upsert.
// item_id+price_date가 유니크라서, 같은 날짜를 다시 수집해도 덮어쓸 뿐 중복이 쌓이지 않는다.
// 이 함수는 세 곳에서 호출된다: ①매일 cron이 "이미 수집된 품목"을 갱신할 때
// ②사용자가 처음 조회하는 품목을 그 자리에서 즉시 캐싱할 때 ③도매가 토글을 처음 켤 때
// (lib/priceSummary.ts). seCode를 다르게 주면 같은 품목이라도 소매/도매를 별도 슬러그로
// 캐싱한다 — entry.slug는 호출부에서 이미 가격유형별로 구분된 값을 넘겨준다.
export async function syncItem(
  entry: Pick<BrowsableItem, "slug" | "name" | "category" | "ctgryCode" | "itemCode">,
  seCode: string = "01",
): Promise<SyncItemResult> {
  const supabase = getSupabaseServerClient();

  const today = new Date();
  const startDate = toYyyymmdd(addDays(today, -400));
  const endDate = toYyyymmdd(today);

  const rows = await fetchKamisDailyPrices({
    ctgryCode: entry.ctgryCode,
    itemCode: entry.itemCode,
    startDate,
    endDate,
    seCode,
  });
  const daily = normalizeToDailyPrices(rows);
  if (daily.length === 0) {
    throw new Error(`${entry.name}: KAMIS 데이터가 없습니다.`);
  }

  const unitLabel = daily[daily.length - 1].unit;

  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .upsert(
      {
        slug: entry.slug,
        name: entry.name,
        category: entry.category,
        unit_label: unitLabel,
        source: "kamis",
        source_params: { ctgryCode: entry.ctgryCode, itemCode: entry.itemCode, seCode },
        is_active: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (itemError || !itemRow) {
    throw new Error(`${entry.name}: items upsert 실패 - ${itemError?.message}`);
  }

  const priceRows = daily.map((d) => ({
    item_id: itemRow.id as string,
    price_date: yyyymmddToIso(d.date),
    retail_price: d.price,
  }));

  const { error: priceError } = await supabase
    .from("daily_prices")
    .upsert(priceRows, { onConflict: "item_id,price_date" });

  if (priceError) {
    throw new Error(`${entry.name}: daily_prices upsert 실패 - ${priceError.message}`);
  }

  return {
    slug: entry.slug,
    itemId: itemRow.id as string,
    unitLabel,
    rowsWritten: priceRows.length,
  };
}

export interface SyncAllResult {
  results: SyncItemResult[];
  errors: { slug: string; message: string }[];
}

interface ItemRow {
  slug: string;
  name: string;
  category: BrowsableItem["category"];
  source_params: { ctgryCode: string; itemCode: string; seCode?: string };
}

// 활성 품목이 늘어날수록 "한 번에 전부" 갱신하면 함수 제한시간을 넘기기 쉽다
// (실측: 8개로도 60초 초과). 그래서 매 실행마다 일부(BATCH_SIZE)만, 가장 오래
// 갱신 안 된 것부터 처리하고, cron을 자주 돌려(vercel.json) 전체가 순환하며
// 갱신되게 한다 — 품목 수가 늘어나도 실행시간은 항상 배치 크기만큼으로 유지됨.
const BATCH_SIZE = 4;

// 동시성을 너무 높이면 품목마다 내부적으로도 페이지를 병렬 요청하기 때문에
// (kamis/client.ts) 합쳐서 data.go.kr의 순간 요청 제한(429)에 걸린다
// (실측: 동시 5개에서 대부분 429). 2로 절충.
const SYNC_CONCURRENCY = 2;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// cron이 주기적으로 호출 — MVP 고정 목록이 아니라, 그동안 사용자가 조회해서
// "이미 DB에 쌓인" 품목들만 갱신한다. 조회된 적 없는 품목은 손대지 않는다.
// 소매/도매가 각각 별도 행으로 저장돼 있으므로, 저장된 seCode 그대로 갱신한다.
// 한 번에 BATCH_SIZE개만, last_synced_at이 가장 오래된 것부터 처리해서 전체가
// 여러 번의 실행에 걸쳐 순환 갱신되게 한다.
export async function syncAllActiveItems(): Promise<SyncAllResult> {
  const supabase = getSupabaseServerClient();

  const { data: existingItems, error: listError } = await supabase
    .from("items")
    .select("slug, name, category, source_params")
    .eq("is_active", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (listError) {
    throw new Error(`활성 품목 조회 실패: ${listError.message}`);
  }

  const rows = (existingItems ?? []) as ItemRow[];
  const settled = await mapWithConcurrency(rows, SYNC_CONCURRENCY, (row) =>
    syncItem(
      {
        slug: row.slug,
        name: row.name,
        category: row.category,
        ctgryCode: row.source_params.ctgryCode,
        itemCode: row.source_params.itemCode,
      },
      row.source_params.seCode ?? "01",
    ),
  );

  const results: SyncItemResult[] = [];
  const errors: { slug: string; message: string }[] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      errors.push({
        slug: rows[i].slug,
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  const status = errors.length === 0 ? "success" : results.length === 0 ? "failed" : "partial";
  await supabase.from("sync_runs").insert({
    source: "kamis",
    run_date: new Date().toISOString().slice(0, 10),
    status,
    items_synced: results.length,
    error_message: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return { results, errors };
}
