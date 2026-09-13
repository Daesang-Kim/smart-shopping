import { XMLParser } from "fast-xml-parser";
import type { EkapeItem, EkapeQuery, EkapeResponse } from "./types";
import { addDays, parseYyyymmdd, toYyyymmdd } from "../date";

// data.ekape.or.kr는 HTTPS를 지원하지 않는다 (직접 확인: https 요청은 타임아웃).
const ENDPOINT = "http://data.ekape.or.kr/openapi-data/service/user/grade/consumerPriceDaily";

// parseTagValue를 끄는 이유: 기본값(true)이면 "00" 같은 값을 숫자 0으로 바꿔버려서
// resultCode("00") 비교가 깨진다 — 전부 문자열로만 다룬다.
const parser = new XMLParser({ isArray: (name) => name === "item", parseTagValue: false });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EkapeDailyRow {
  date: string; // YYYYMMDD
  price: number;
  unit: string;
}

// 이 API는 KAMIS와 달리 기간 조회가 안 되고 하루당 1회 호출해야 한다.
// 실패 시 잠깐 쉬었다가 최대 2번 재시도한다. 문서상 스펙(평균 응답 200ms)보다 실제로는
// 느리고 가끔 타임아웃되는 걸 확인해서 타임아웃을 넉넉히 잡았다.
async function fetchOneDay(query: EkapeQuery, dateYmd: string): Promise<EkapeDailyRow | null> {
  const serviceKey = process.env.EKAPE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("EKAPE_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
  }

  const params = new URLSearchParams({
    serviceKey,
    standYmd: dateYmd,
    judgeKind: query.judgeKind,
    itemCd: query.itemCd,
  });
  const url = `${ENDPOINT}?${params.toString()}`;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        throw new Error(`EKAPE API 요청 실패: ${res.status} ${res.statusText}`);
      }

      const xml = await res.text();
      const data = parser.parse(xml) as EkapeResponse;
      if (data.response.header.resultCode !== "00") {
        throw new Error(
          `EKAPE API 오류: ${data.response.header.resultCode} ${data.response.header.resultMsg}`,
        );
      }

      const items: EkapeItem[] = data.response.body?.items?.item ?? [];
      // 응답엔 해당 날짜 실측치와 "평년"(과거 평균)이 섞여 오고, 소/수입갈비처럼
      // 등급·원산지별로 여러 row가 같이 오는 품목도 있어 날짜+구분값을 모두 맞춰야 한다.
      const todayItem = items.find(
        (it) => it.standYmd === dateYmd && (query.grade === undefined || it.grdNm === query.grade),
      );
      if (!todayItem) return null; // 조사 안 된 날 — 정상

      const price = Number(todayItem.ntslPrc);
      if (!Number.isFinite(price) || price <= 0) return null;

      return { date: dateYmd, price, unit: todayItem.unit.replace(/^원\//, "") };
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
  return null;
}

const CONCURRENCY = 8;

// 하루 1건씩만 되는 API라 400일치를 받으려면 400번 호출해야 한다. 동시성을 너무
// 높이면(실측: 15에서 일부 요청이 타임아웃) 이 서버가 버거워하는 것 같아 낮췄다.
// 특정 날짜 하나가 끝까지 실패해도(재시도 3번 다 실패) 그 날짜만 빼고 계속 진행한다 —
// 하루치 때문에 400일 전체 조회가 통째로 실패하면 안 되므로.
export async function fetchEkapeDailyPrices(
  query: EkapeQuery,
  startDate: string,
  endDate: string,
): Promise<EkapeDailyRow[]> {
  const dates: string[] = [];
  let cursor = parseYyyymmdd(startDate);
  const end = parseYyyymmdd(endDate);
  while (cursor <= end) {
    dates.push(toYyyymmdd(cursor));
    cursor = addDays(cursor, 1);
  }

  const rows: EkapeDailyRow[] = [];
  let index = 0;

  async function worker() {
    while (index < dates.length) {
      const i = index++;
      try {
        const row = await fetchOneDay(query, dates[i]);
        if (row) rows.push(row);
      } catch {
        // 이 날짜만 건너뛴다 — 전체를 실패시키지 않음
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dates.length) }, worker));

  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}
