import KoreanLunarCalendar from "korean-lunar-calendar";

export interface Holiday {
  name: string;
  date: string; // YYYYMMDD (양력)
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 설날(음력 1/1)·추석(음력 8/15)의 양력 날짜를 매년 새로 계산한다 — 하드코딩 금지
// (달력마다 양력 날짜가 다름. 예: 2025년 추석 10/6, 2026년 추석 9/25).
export function getHolidaysForYear(year: number): Holiday[] {
  const cal = new KoreanLunarCalendar();

  cal.setLunarDate(year, 1, 1, false);
  const seollal = cal.getSolarCalendar();

  cal.setLunarDate(year, 8, 15, false);
  const chuseok = cal.getSolarCalendar();

  return [
    { name: "설날", date: `${seollal.year}${pad(seollal.month)}${pad(seollal.day)}` },
    { name: "추석", date: `${chuseok.year}${pad(chuseok.month)}${pad(chuseok.day)}` },
  ];
}

// 연말/연초 경계에서도 놓치는 명절이 없도록 앞뒤 해까지 넉넉히 계산한다.
export function getNearbyHolidays(referenceYear: number): Holiday[] {
  return [referenceYear - 1, referenceYear, referenceYear + 1].flatMap(getHolidaysForYear);
}
