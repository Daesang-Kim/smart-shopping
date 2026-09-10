import { fetchKamisDailyPrices } from "./kamis/client";
import type { Item } from "./items";
import { normalizeToDailyPrices, type DailyPrice } from "./normalize";
import { addDays, toYyyymmdd } from "./date";
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

export async function getPriceSummary(item: Item): Promise<PriceSummary> {
  const today = new Date();
  // 90일 통계 + 작년 동기 비교(약 365일 전, ±5일 여유)를 모두 커버하도록 넉넉히 400일 조회
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
    throw new Error("해당 품목의 최근 조사 데이터가 없습니다.");
  }

  const latest = daily[daily.length - 1];
  const window90 = last90Days(daily);

  return {
    item: { id: item.id, name: item.name, category: item.category, unit: latest.unit },
    today: { date: latest.date, price: latest.price },
    percentile: percentileBadge(window90, latest.price),
    range90: priceRange(window90),
    weekday: weekdayAverages(daily),
    yoy: yoyComparison(daily, latest.date, latest.price),
    series90: window90,
  };
}
