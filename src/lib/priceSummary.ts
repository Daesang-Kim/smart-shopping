import { getSupabaseServerClient } from "./supabase";
import type { Item } from "./items";
import type { DailyPrice } from "./normalize";
import {
  last90Days,
  percentileBadge,
  priceRange,
  weekdayAverages,
  yoyComparison,
  type PercentileBadge,
  type PriceRange,
  type WeekdayAverages,
  type YoyComparison,
} from "./stats";

export interface PriceSummary {
  item: { id: string; name: string; category: string; unit: string };
  today: { date: string; price: number };
  percentile: PercentileBadge;
  range90: PriceRange;
  weekday: WeekdayAverages;
  yoy: YoyComparison | null;
  series90: DailyPrice[];
}

// Supabase(daily_prices)에 cron이 미리 캐싱해둔 데이터를 읽어서 통계를 계산한다.
// KAMIS 라이브 호출은 src/lib/sync.ts(cron)에서만 일어나고, 앱은 항상 DB만 본다.
export async function getPriceSummary(item: Item): Promise<PriceSummary> {
  const supabase = getSupabaseServerClient();

  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .select("id, unit_label")
    .eq("slug", item.id)
    .single();

  if (itemError || !itemRow) {
    throw new Error(`"${item.name}" 데이터가 아직 수집되지 않았습니다. (cron 동기화 필요)`);
  }

  const { data: priceRows, error: priceError } = await supabase
    .from("daily_prices")
    .select("price_date, retail_price")
    .eq("item_id", itemRow.id)
    .order("price_date", { ascending: true });

  if (priceError) {
    throw new Error(priceError.message);
  }
  if (!priceRows || priceRows.length === 0) {
    throw new Error(`"${item.name}" 가격 데이터가 없습니다.`);
  }

  const daily: DailyPrice[] = priceRows.map((row) => ({
    date: row.price_date.replace(/-/g, ""),
    price: Number(row.retail_price),
    unit: itemRow.unit_label,
  }));

  const latest = daily[daily.length - 1];
  const window90 = last90Days(daily);

  return {
    item: { id: item.id, name: item.name, category: item.category, unit: itemRow.unit_label },
    today: { date: latest.date, price: latest.price },
    percentile: percentileBadge(window90, latest.price),
    range90: priceRange(window90),
    weekday: weekdayAverages(daily),
    yoy: yoyComparison(daily, latest.date, latest.price),
    series90: window90,
  };
}
