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
// 이 함수는 두 곳에서 호출된다: ①매일 cron이 "이미 수집된 품목"을 갱신할 때
// ②사용자가 처음 조회하는 품목을 그 자리에서 즉시 캐싱할 때(lib/priceSummary.ts)
export async function syncItem(
  entry: Pick<BrowsableItem, "slug" | "name" | "category" | "ctgryCode" | "itemCode">,
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
        source_params: { ctgryCode: entry.ctgryCode, itemCode: entry.itemCode },
        is_active: true,
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
  source_params: { ctgryCode: string; itemCode: string };
}

// 매일 cron이 호출 — MVP 고정 목록이 아니라, 그동안 사용자가 조회해서
// "이미 DB에 쌓인" 품목들만 갱신한다. 조회된 적 없는 품목은 손대지 않는다.
export async function syncAllActiveItems(): Promise<SyncAllResult> {
  const supabase = getSupabaseServerClient();

  const { data: existingItems, error: listError } = await supabase
    .from("items")
    .select("slug, name, category, source_params")
    .eq("is_active", true);

  if (listError) {
    throw new Error(`활성 품목 조회 실패: ${listError.message}`);
  }

  const results: SyncItemResult[] = [];
  const errors: { slug: string; message: string }[] = [];

  for (const row of (existingItems ?? []) as ItemRow[]) {
    try {
      results.push(
        await syncItem({
          slug: row.slug,
          name: row.name,
          category: row.category,
          ctgryCode: row.source_params.ctgryCode,
          itemCode: row.source_params.itemCode,
        }),
      );
    } catch (err) {
      errors.push({
        slug: row.slug,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

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
