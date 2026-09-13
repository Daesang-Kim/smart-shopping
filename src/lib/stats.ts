import { addDays, addYears, diffDays, parseYyyymmdd, weekdayLabel } from "./date";
import type { DailyPrice } from "./normalize";
import { getNearbyHolidays } from "./holidays";

export function last90Days(daily: DailyPrice[]): DailyPrice[] {
  if (daily.length === 0) return [];
  const latest = parseYyyymmdd(daily[daily.length - 1].date);
  const cutoff = addDays(latest, -90);
  return daily.filter((d) => parseYyyymmdd(d.date) >= cutoff);
}

export interface ChartPoint {
  offsetDays: number; // 기준일(오늘 또는 작년 오늘) 대비 며칠 떨어져 있는지
  price: number;
  date: string;
}

export interface ChartHolidayMarker {
  name: string;
  offsetDays: number;
  date: string;
}

export interface ChartData {
  thisYear: ChartPoint[]; // 최근 90일 실측치 (오늘까지, 미래는 그리지 않음)
  lastYear: ChartPoint[]; // 작년 동기간 -90일 ~ +30일 (작년 데이터는 이미 다 있으므로 미래분까지 표시)
  holidaysThisYear: ChartHolidayMarker[];
  holidaysLastYear: ChartHolidayMarker[];
}

export const CHART_PAST_DAYS = 90;
export const CHART_FUTURE_DAYS = 30;

// 올해 라인과 작년 라인을 "기준일로부터 며칠"이라는 공통 x축(offsetDays)에 정렬해서
// 같은 위치에서 두 해를 비교할 수 있게 한다. 명절은 매년 양력 날짜가 달라지므로
// (예: 추석 2025-10-06, 2026-09-25) 하드코딩 없이 그때그때 계산해 각 라인 기준으로 위치를 잡는다.
export function buildChartData(daily: DailyPrice[], todayDate: string): ChartData {
  const today = parseYyyymmdd(todayDate);
  const lastYearAnchor = addYears(today, -1);

  const thisYear: ChartPoint[] = [];
  const lastYear: ChartPoint[] = [];

  for (const d of daily) {
    const date = parseYyyymmdd(d.date);

    const offsetFromToday = diffDays(date, today);
    if (offsetFromToday >= -CHART_PAST_DAYS && offsetFromToday <= 0) {
      thisYear.push({ offsetDays: offsetFromToday, price: d.price, date: d.date });
    }

    const offsetFromLastYear = diffDays(date, lastYearAnchor);
    if (offsetFromLastYear >= -CHART_PAST_DAYS && offsetFromLastYear <= CHART_FUTURE_DAYS) {
      lastYear.push({ offsetDays: offsetFromLastYear, price: d.price, date: d.date });
    }
  }

  const holidaysThisYear: ChartHolidayMarker[] = [];
  const holidaysLastYear: ChartHolidayMarker[] = [];

  for (const h of getNearbyHolidays(today.getFullYear())) {
    const hDate = parseYyyymmdd(h.date);

    const offsetFromToday = diffDays(hDate, today);
    if (offsetFromToday >= -CHART_PAST_DAYS && offsetFromToday <= 0) {
      holidaysThisYear.push({ name: h.name, offsetDays: offsetFromToday, date: h.date });
    }

    const offsetFromLastYear = diffDays(hDate, lastYearAnchor);
    if (offsetFromLastYear >= -CHART_PAST_DAYS && offsetFromLastYear <= CHART_FUTURE_DAYS) {
      holidaysLastYear.push({ name: h.name, offsetDays: offsetFromLastYear, date: h.date });
    }
  }

  return { thisYear, lastYear, holidaysThisYear, holidaysLastYear };
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

export interface WeekendAverage {
  value: number;
  estimated: boolean; // false면 실측값(축평원 등 주말도 조사하는 소스), true면 추정값
}

export interface WeekdayAverages {
  actual: Record<"월" | "화" | "수" | "목" | "금", number>;
  weekend: Record<"토" | "일", WeekendAverage>;
  cheapestDay: string;
}

// 최근 3개월 기준 요일별 평균가. KAMIS는 토·일 조사를 하지 않아 추정이 필요하지만
// (스펙 정의대로 토=금+(월-금)/3, 일=금+(월-금)*2/3), 축평원처럼 주말도 실제로
// 조사하는 소스는 실측 평균을 그대로 쓴다 — 데이터가 있는데 억지로 추정할 이유가 없다.
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
    토: { sum: 0, count: 0 },
    일: { sum: 0, count: 0 },
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
  const weekend: Record<"토" | "일", WeekendAverage> = {
    토:
      sums["토"].count > 0
        ? { value: Math.round(sums["토"].sum / sums["토"].count), estimated: false }
        : { value: Math.round(fri + (mon - fri) / 3), estimated: true },
    일:
      sums["일"].count > 0
        ? { value: Math.round(sums["일"].sum / sums["일"].count), estimated: false }
        : { value: Math.round(fri + ((mon - fri) * 2) / 3), estimated: true },
  };

  const allDays = { ...actual, 토: weekend.토.value, 일: weekend.일.value };
  const cheapestDay = Object.entries(allDays).sort((a, b) => a[1] - b[1])[0][0];

  return { actual, weekend, cheapestDay };
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
