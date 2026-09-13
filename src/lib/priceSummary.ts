import { getSupabaseServerClient } from "./supabase";
import type { BrowsableItem } from "./catalog";
import type { DailyPrice } from "./normalize";
import { syncItem } from "./sync";
import {
  buildChartData,
  last90Days,
  percentileBadge,
  priceRange,
  weekdayAverages,
  yoyComparison,
  type ChartData,
  type PercentileBadge,
  type PriceRange,
  type WeekdayAverages,
  type YoyComparison,
} from "./stats";

export type PriceType = "retail" | "wholesale";

export interface PriceSummary {
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
    priceType: PriceType;
    source: BrowsableItem["source"];
  };
  today: { date: string; price: number };
  percentile: PercentileBadge;
  range90: PriceRange;
  weekday: WeekdayAverages;
  yoy: YoyComparison | null;
  chart: ChartData;
}

function seCodeOf(priceType: PriceType): string {
  return priceType === "wholesale" ? "02" : "01"; // KAMIS 구분코드: 01=소매, 02=중도매(도매)
}

// 도매가는 소매가와 완전히 다른 데이터이므로 별도 슬러그(캐시 행)로 저장한다.
function cacheSlugOf(entry: BrowsableItem, priceType: PriceType): string {
  return priceType === "wholesale" ? `${entry.slug}-w` : entry.slug;
}

// Supabase(daily_prices)에 캐싱된 데이터를 읽어서 통계를 계산한다.
// 처음 조회하는 품목(=DB에 아직 없는 품목)은 이 자리에서 즉시 KAMIS를 호출해 캐싱한 뒤
// 이어서 통계를 계산한다 — 그래서 최초 1회만 느리고, 이후 방문부터는 DB만 읽어 빠르다.
// 도매가도 마찬가지로, 사용자가 토글을 눌러 처음 요청할 때만 그 자리에서 수집한다.
export async function getPriceSummary(
  entry: BrowsableItem,
  priceType: PriceType = "retail",
): Promise<PriceSummary> {
  if (priceType === "wholesale" && entry.source === "ekape") {
    throw new Error(`"${entry.name}"은(는) 도매가를 제공하지 않습니다.`);
  }

  const supabase = getSupabaseServerClient();
  const cacheSlug = cacheSlugOf(entry, priceType);

  const { data: existingRow } = await supabase
    .from("items")
    .select("id, unit_label")
    .eq("slug", cacheSlug)
    .maybeSingle();

  // 캐시에 없으면 그 자리에서 즉시 수집한다. syncItem이 방금 만든 행의 id를 직접
  // 돌려주므로, 별도 재조회 없이 바로 이어서 쓴다(재조회는 일시적 네트워크 오류에도
  // 취약해서 제거함).
  let itemRow: { id: string; unit_label: string };
  if (existingRow) {
    itemRow = existingRow;
  } else {
    const synced = await syncItem({ ...entry, slug: cacheSlug }, seCodeOf(priceType));
    itemRow = { id: synced.itemId, unit_label: synced.unitLabel };
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
    throw new Error(`"${entry.name}" 가격 데이터가 없습니다.`);
  }

  const daily: DailyPrice[] = priceRows.map((row) => ({
    date: row.price_date.replace(/-/g, ""),
    price: Number(row.retail_price),
    unit: itemRow.unit_label,
  }));

  const latest = daily[daily.length - 1];
  const window90 = last90Days(daily);

  return {
    item: {
      id: entry.slug,
      name: entry.name,
      category: entry.category,
      unit: itemRow.unit_label,
      priceType,
      source: entry.source,
    },
    today: { date: latest.date, price: latest.price },
    percentile: percentileBadge(window90, latest.price),
    range90: priceRange(window90),
    weekday: weekdayAverages(daily),
    yoy: yoyComparison(daily, latest.date, latest.price),
    chart: buildChartData(daily, latest.date),
  };
}
