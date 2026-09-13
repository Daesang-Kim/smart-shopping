import { getSupabaseServerClient } from "./supabase";
import type { BrowsableItem } from "./catalog";
import { fetchKamisDailyPrices } from "./kamis/client";
import { fetchEkapeDailyPrices } from "./ekape/client";
import { normalizeToDailyPrices, type DailyPrice } from "./normalize";
import { addDays, toYyyymmdd } from "./date";

function yyyymmddToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface ExistingItemState {
  unitLabel: string;
  lastStoredDate: string | null;
}

// 이미 저장된 품목인지, 있다면 가장 최근 날짜와 기존 unit_label을 찾는다 — 있으면
// 그 다음날부터만 요청하면 돼서, 특히 하루 1건씩만 되는 축평원(ekape) 쪽 요청 수를
// 크게 아낀다. 품목이 처음 보는 slug면(신규) null을 반환해서 호출부가 전체
// backfillDays를 받게 한다. unit_label을 같이 돌려주는 이유: 이번에 새로 받은 날짜가
// 없어도(daily.length===0) upsert 시 NOT NULL 컬럼에 값을 채워야 하기 때문
// (Postgres는 ON CONFLICT DO UPDATE라도 컬럼이 아예 빠지면 충돌 감지 전에 NOT NULL
// 위반으로 실패한다 — 기존 값을 그대로 다시 넣어줘야 함).
async function getExistingItemState(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  slug: string,
): Promise<ExistingItemState | null> {
  const { data: itemRow } = await supabase
    .from("items")
    .select("id, unit_label")
    .eq("slug", slug)
    .maybeSingle();
  if (!itemRow) return null;

  const { data: priceRow } = await supabase
    .from("daily_prices")
    .select("price_date")
    .eq("item_id", itemRow.id)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    unitLabel: itemRow.unit_label as string,
    lastStoredDate: (priceRow?.price_date as string | undefined) ?? null,
  };
}

async function fetchDaily(
  entry: BrowsableItem,
  startDate: string,
  endDate: string,
  seCode: string,
): Promise<DailyPrice[]> {
  if (entry.source === "kamis") {
    const rows = await fetchKamisDailyPrices({
      ctgryCode: entry.ctgryCode,
      itemCode: entry.itemCode,
      startDate,
      endDate,
      seCode,
    });
    return normalizeToDailyPrices(rows);
  }

  // ekape는 이미 전국 평균가를 하루 단위로 주므로 KAMIS처럼 여러 시장을 평균 낼 필요가 없다.
  const rows = await fetchEkapeDailyPrices(
    { judgeKind: entry.judgeKind, itemCd: entry.itemCd, grade: entry.grade },
    startDate,
    endDate,
  );
  return rows;
}

export interface SyncItemResult {
  slug: string;
  itemId: string;
  unitLabel: string;
  rowsWritten: number;
}

// 품목 하나에 대해: 소스(KAMIS/축평원)에서 가져와 정규화 → items/daily_prices에 upsert.
// item_id+price_date가 유니크라서, 같은 날짜를 다시 수집해도 덮어쓸 뿐 중복이 쌓이지 않는다.
// 이 함수는 세 곳에서 호출된다: ①매일 cron이 "이미 수집된 품목"을 갱신할 때
// ②사용자가 처음 조회하는 품목을 그 자리에서 즉시 캐싱할 때 ③도매가 토글을 처음 켤 때
// (lib/priceSummary.ts). seCode는 KAMIS 품목에만 의미가 있다(축평원은 소매/도매 구분이
// 없어 무시됨) — entry.slug는 호출부에서 이미 가격유형별로 구분된 값을 넘겨준다.
export async function syncItem(
  entry: BrowsableItem,
  seCode: string = "01",
): Promise<SyncItemResult> {
  const supabase = getSupabaseServerClient();

  const today = new Date();
  // 축평원(ekape)은 KAMIS처럼 기간 조회가 안 되고 날짜별로 1건씩 호출해야 해서
  // 훨씬 느리다 — 실측: 400일 백필 시 서울 리전에서도 45초 넘게 걸려 함수 제한시간
  // (60초)에 너무 가까웠음. 그래서 ekape는 100일만 백필한다(작년 비교/작년 점선
  // 라인은 데이터 부족으로 자연히 생략됨 — 계절성 품목과 같은 트레이드오프).
  const backfillDays = entry.source === "ekape" ? 100 : 400;
  const endDate = toYyyymmdd(today);

  // 이미 저장된 마지막 날짜가 있으면 그 다음날부터만 요청한다 — 특히 축평원은
  // 하루 1건씩 호출해야 해서(오퍼레이션당 일일 1,000건 한도), 매번 backfillDays
  // 전체를 다시 받으면 품목 수가 늘수록 금방 한도를 소진한다. 신규 품목(저장된
  // 날짜 없음)만 전체 backfillDays를 받는다.
  const existing = await getExistingItemState(supabase, entry.slug);
  const startDate = existing?.lastStoredDate
    ? toYyyymmdd(addDays(parseIsoDate(existing.lastStoredDate), 1))
    : toYyyymmdd(addDays(today, -backfillDays));

  // 어제까지 이미 오늘자 데이터를 받아둔 경우 등 — 새로 받을 날짜가 없으면
  // API를 호출하지 않고 last_synced_at만 갱신한다 (배치 순환 순서 갱신용).
  const daily = startDate <= endDate ? await fetchDaily(entry, startDate, endDate, seCode) : [];
  if (daily.length === 0 && !existing) {
    throw new Error(`${entry.name}: 데이터가 없습니다.`);
  }

  // 새로 받은 데이터가 없으면 기존 unit_label을 그대로 다시 채운다 — 값을 비우면
  // Postgres가 ON CONFLICT DO UPDATE라도 INSERT 후보 행을 먼저 구성하는 과정에서
  // NOT NULL 위반으로 실패한다(충돌 감지보다 먼저 체크됨. 실측으로 확인).
  const unitLabel = daily.length > 0 ? daily[daily.length - 1].unit : existing!.unitLabel;
  const sourceParams =
    entry.source === "kamis"
      ? { ctgryCode: entry.ctgryCode, itemCode: entry.itemCode, seCode }
      : { judgeKind: entry.judgeKind, itemCd: entry.itemCd, grade: entry.grade };

  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .upsert(
      {
        slug: entry.slug,
        name: entry.name,
        category: entry.category,
        unit_label: unitLabel,
        source: entry.source,
        source_params: sourceParams,
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

  // 새로 받을 날짜가 없으면(이미 오늘자까지 저장돼 있음) daily_prices는 건드릴 게
  // 없다 — 빈 배열 upsert는 불필요한 요청이라 건너뛴다.
  if (priceRows.length > 0) {
    const { error: priceError } = await supabase
      .from("daily_prices")
      .upsert(priceRows, { onConflict: "item_id,price_date" });

    if (priceError) {
      throw new Error(`${entry.name}: daily_prices upsert 실패 - ${priceError.message}`);
    }
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
  source: BrowsableItem["source"];
  source_params: {
    ctgryCode?: string;
    itemCode?: string;
    judgeKind?: string;
    itemCd?: string;
    seCode?: string;
    grade?: string;
  };
}

function toBrowsableItem(row: ItemRow): BrowsableItem {
  if (row.source === "kamis") {
    return {
      slug: row.slug,
      name: row.name,
      category: row.category,
      source: "kamis",
      ctgryCode: row.source_params.ctgryCode!,
      itemCode: row.source_params.itemCode!,
    };
  }
  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    source: "ekape",
    judgeKind: row.source_params.judgeKind!,
    itemCd: row.source_params.itemCd!,
    grade: row.source_params.grade,
  };
}

// 활성 품목이 늘어날수록 "한 번에 전부" 갱신하면 함수 제한시간을 넘기기 쉽다
// (실측: 8개 전부를 동시성 2 + 재시도로 처리해도 60초 초과). 그래서 매 실행마다
// 일부(BATCH_SIZE)만, 가장 오래 갱신 안 된 것부터 처리해서 여러 번 실행에 걸쳐
// 전체가 순환 갱신되게 한다 — 품목 수가 늘어나도 1회 실행시간은 항상 배치
// 크기만큼으로 유지됨.
// Vercel Hobby 플랜은 cron이 하루 1회로 제한돼 있어(더 잦은 주기는 배포 자체가
// 거부됨, 실측 확인) 활성 품목이 늘면 전체 순환 주기가 하루보다 길어질 수 있음
// (예: 품목 20개 · 배치 4개면 5일에 한 바퀴). 필요시 Pro 플랜(더 잦은 cron)으로 전환.
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
    .select("slug, name, category, source, source_params")
    .eq("is_active", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (listError) {
    throw new Error(`활성 품목 조회 실패: ${listError.message}`);
  }

  const rows = (existingItems ?? []) as ItemRow[];
  const settled = await mapWithConcurrency(rows, SYNC_CONCURRENCY, (row) =>
    syncItem(toBrowsableItem(row), row.source_params.seCode ?? "01"),
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
