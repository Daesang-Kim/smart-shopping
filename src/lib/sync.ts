import { getSupabaseServerClient } from "./supabase";
import { MVP_ITEMS, type Item } from "./items";
import { fetchKamisDailyPrices } from "./kamis/client";
import { normalizeToDailyPrices } from "./normalize";
import { addDays, toYyyymmdd } from "./date";

function yyyymmddToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export interface SyncItemResult {
  slug: string;
  rowsWritten: number;
}

// 품목 하나에 대해: KAMIS에서 가져와 정규화 → items/daily_prices에 upsert.
// item_id+price_date가 유니크라서, 같은 날짜를 다시 수집해도 덮어쓸 뿐 중복이 쌓이지 않는다.
export async function syncItem(item: Item): Promise<SyncItemResult> {
  const supabase = getSupabaseServerClient();

  const today = new Date();
  const startDate = toYyyymmdd(addDays(today, -400));
  const endDate = toYyyymmdd(today);

  const rows = await fetchKamisDailyPrices({
    ctgryCode: item.sourceParams.ctgryCode,
    itemCode: item.sourceParams.itemCode,
    startDate,
    endDate,
  });
  const daily = normalizeToDailyPrices(rows);
  if (daily.length === 0) {
    throw new Error(`${item.name}: KAMIS 데이터가 없습니다.`);
  }

  const unitLabel = daily[daily.length - 1].unit;

  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .upsert(
      {
        slug: item.id,
        name: item.name,
        category: item.category,
        unit_label: unitLabel,
        source: item.source,
        source_params: item.sourceParams,
        is_active: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (itemError || !itemRow) {
    throw new Error(`${item.name}: items upsert 실패 - ${itemError?.message}`);
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
    throw new Error(`${item.name}: daily_prices upsert 실패 - ${priceError.message}`);
  }

  return { slug: item.id, rowsWritten: priceRows.length };
}

export interface SyncAllResult {
  results: SyncItemResult[];
  errors: { slug: string; message: string }[];
}

export async function syncAllItems(): Promise<SyncAllResult> {
  const results: SyncItemResult[] = [];
  const errors: { slug: string; message: string }[] = [];

  for (const item of MVP_ITEMS) {
    try {
      results.push(await syncItem(item));
    } catch (err) {
      errors.push({
        slug: item.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const supabase = getSupabaseServerClient();
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
