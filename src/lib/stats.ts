import { addDays, parseYyyymmdd, weekdayLabel } from "./date";
import type { DailyPrice } from "./normalize";

export function last90Days(daily: DailyPrice[]): DailyPrice[] {
  if (daily.length === 0) return [];
  const latest = parseYyyymmdd(daily[daily.length - 1].date);
  const cutoff = addDays(latest, -90);
  return daily.filter((d) => parseYyyymmdd(d.date) >= cutoff);
}

export interface PercentileBadge {
  rankFromTopPct: number; // 낮을수록 비싼 쪽 상위
  label: "비싼 편" | "저렴한 편" | "보통";
}

// "상위 X%" = 오늘 가격 이상인 날이 전체 중 몇 %인지.
// 값이 작을수록(예: 상위 5%) 오늘이 최근 90일 중 가장 비싼 축에 속한다는 뜻.
export function percentileBadge(
  windowPrices: DailyPrice[],
  todayPrice: number,
): PercentileBadge {
  const total = windowPrices.length;
  const countAtOrAbove = windowPrices.filter((d) => d.price >= todayPrice).length;
  const rankFromTopPct = Math.round((countAtOrAbove / total) * 100);

  let label: PercentileBadge["label"] = "보통";
  if (rankFromTopPct <= 25) label = "비싼 편";
  else if (rankFromTopPct >= 75) label = "저렴한 편";

  return { rankFromTopPct, label };
}

export interface PriceRange {
  min: number;
  max: number;
  minDate: string;
  maxDate: string;
}

export function priceRange(windowPrices: DailyPrice[]): PriceRange {
  let min = windowPrices[0];
  let max = windowPrices[0];
  for (const d of windowPrices) {
    if (d.price < min.price) min = d;
    if (d.price > max.price) max = d;
  }
  return { min: min.price, max: max.price, minDate: min.date, maxDate: max.date };
}

export interface WeekdayAverages {
  actual: Record<"월" | "화" | "수" | "목" | "금", number>;
  estimated: Record<"토" | "일", number>;
  cheapestDay: string;
}

// 최근 3개월 기준 요일별 평균가. KAMIS는 토·일 조사를 하지 않으므로,
// 스펙 정의대로 토=금+(월-금)/3, 일=금+(월-금)*2/3 으로 추정한다.
export function weekdayAverages(daily: DailyPrice[]): WeekdayAverages {
  if (daily.length === 0) {
    throw new Error("데이터가 없어 요일별 평균을 계산할 수 없습니다.");
  }
  const latest = parseYyyymmdd(daily[daily.length - 1].date);
  const cutoff = addDays(latest, -90);
  const recent = daily.filter((d) => parseYyyymmdd(d.date) >= cutoff);

  const sums: Record<string, { sum: number; count: number }> = {
    월: { sum: 0, count: 0 },
    화: { sum: 0, count: 0 },
    수: { sum: 0, count: 0 },
    목: { sum: 0, count: 0 },
    금: { sum: 0, count: 0 },
  };

  for (const d of recent) {
    const label = weekdayLabel(parseYyyymmdd(d.date));
    if (label in sums) {
      sums[label].sum += d.price;
      sums[label].count += 1;
    }
  }

  const actual = {
    월: Math.round(sums["월"].sum / sums["월"].count),
    화: Math.round(sums["화"].sum / sums["화"].count),
    수: Math.round(sums["수"].sum / sums["수"].count),
    목: Math.round(sums["목"].sum / sums["목"].count),
    금: Math.round(sums["금"].sum / sums["금"].count),
  };

  const mon = actual["월"];
  const fri = actual["금"];
  const estimated = {
    토: Math.round(fri + (mon - fri) / 3),
    일: Math.round(fri + ((mon - fri) * 2) / 3),
  };

  const allDays = { ...actual, ...estimated };
  const cheapestDay = Object.entries(allDays).sort((a, b) => a[1] - b[1])[0][0];

  return { actual, estimated, cheapestDay };
}

export interface YoyComparison {
  lastYearPrice: number;
  lastYearDate: string;
  changePct: number;
}

// 작년 오늘과 정확히 같은 날짜에 조사값이 없을 수 있어(공휴일 등),
// 가장 가까운 날짜(최대 ±5일)를 찾아 비교한다.
export function yoyComparison(
  daily: DailyPrice[],
  todayDate: string,
  todayPrice: number,
): YoyComparison | null {
  const target = addDays(parseYyyymmdd(todayDate), -365);

  let closest: DailyPrice | null = null;
  let closestDiff = Infinity;
  for (const d of daily) {
    const diff = Math.abs(parseYyyymmdd(d.date).getTime() - target.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = d;
    }
  }

  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  if (!closest || closestDiff > fiveDaysMs) return null;

  const changePct = Math.round(((todayPrice - closest.price) / closest.price) * 100);
  return { lastYearPrice: closest.price, lastYearDate: closest.date, changePct };
}
