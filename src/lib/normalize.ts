import type { KamisRawRow } from "./kamis/types";

export interface DailyPrice {
  date: string; // YYYYMMDD
  price: number; // 해당 날짜 전국 조사 시장 평균 소매가
  unit: string; // 표시 단위, 예: "kg", "포기"
}

// KAMIS는 하루에 여러 시장(mrkt_cd)·품종(vrty_cd)의 값을 개별 row로 반환한다.
// MVP 단순화: 같은 날짜의 모든 row를 평균 내어 "오늘의 대표 소매가" 하나로 취급한다.
// (품종별로 나누면 더 정확하지만, 여러 품종이 뒤섞여 조사되는 날도 있어 표본이 줄어드는 트레이드오프가 있음)
export function normalizeToDailyPrices(rows: KamisRawRow[]): DailyPrice[] {
  const byDate = new Map<string, { sum: number; count: number; unit: string }>();

  for (const row of rows) {
    const price = Number(row.exmn_dd_prc);
    if (!Number.isFinite(price) || price <= 0) continue;

    const entry = byDate.get(row.exmn_ymd);
    if (entry) {
      entry.sum += price;
      entry.count += 1;
    } else {
      byDate.set(row.exmn_ymd, { sum: price, count: 1, unit: row.unit });
    }
  }

  return Array.from(byDate.entries())
    .map(([date, { sum, count, unit }]) => ({
      date,
      price: Math.round(sum / count),
      unit,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
