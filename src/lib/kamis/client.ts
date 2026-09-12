import type { KamisApiResponse, KamisQuery, KamisRawRow } from "./types";

const ENDPOINT = "https://apis.data.go.kr/B552845/perDay/price";
const MAX_ROWS_PER_PAGE = 1000; // API 명세상 numOfRows 최대값

function buildUrl(query: KamisQuery, pageNo: number): string {
  const serviceKey = process.env.KAMIS_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("KAMIS_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
  }

  const params = new URLSearchParams({
    serviceKey,
    returnType: "json",
    pageNo: String(pageNo),
    numOfRows: String(MAX_ROWS_PER_PAGE),
    "cond[exmn_ymd::GTE]": query.startDate,
    "cond[exmn_ymd::LTE]": query.endDate,
    "cond[se_cd::EQ]": query.seCode ?? "01",
    "cond[ctgry_cd::EQ]": query.ctgryCode,
    "cond[item_cd::EQ]": query.itemCode,
  });

  return `${ENDPOINT}?${params.toString()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 4;

// data.go.kr는 짧은 시간에 요청이 몰리면 429(Too Many Requests)를 준다 — 여러 품목을
// 동시에 동기화할 때 실제로 겪은 문제. 429만 골라서 잠깐 쉬었다가 재시도한다.
// 지연에 무작위성(jitter)을 섞는 이유: 동시에 시작된 여러 요청이 똑같은 backoff
// 스케줄을 타면 재시도마저 서로 같은 타이밍에 몰려 또 429를 유발하는 걸 실제로 봤다.
async function fetchPage(query: KamisQuery, pageNo: number) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(buildUrl(query, pageNo));

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const backoff = 700 * 2 ** attempt;
      const jitter = Math.random() * backoff * 0.5;
      await sleep(backoff + jitter);
      continue;
    }
    if (!res.ok) {
      throw new Error(`KAMIS API 요청 실패: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as KamisApiResponse;
    const { header, body } = data.response;
    if (header.resultCode !== "0") {
      throw new Error(`KAMIS API 오류: ${header.resultCode} ${header.resultMsg}`);
    }

    return body;
  }
  throw new Error("KAMIS API 요청 실패: 429 Too Many Requests (재시도 초과)");
}

// KAMIS는 날짜당 여러 시장(mrkt_cd)의 조사값을 개별 row로 반환하므로,
// 기간이 길면 totalCount가 numOfRows(최대 1000)를 넘어 페이지네이션이 필요하다.
// 한 품목 안에서는 페이지를 병렬로 가져와 지연을 줄이고(보통 몇 페이지뿐이라 순간
// 요청 제한에 잘 안 걸림), 429가 나면 재시도로 흡수한다. 여러 품목을 "동시에" 도는
// 동시성 제한은 호출부(lib/sync.ts)에서 따로 관리한다.
export async function fetchKamisDailyPrices(
  query: KamisQuery,
): Promise<KamisRawRow[]> {
  const firstPage = await fetchPage(query, 1);
  const rows: KamisRawRow[] = "item" in firstPage.items ? [...firstPage.items.item] : [];

  const totalPages = Math.ceil(firstPage.totalCount / MAX_ROWS_PER_PAGE);
  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(query, i + 2)),
    );
    for (const page of remainingPages) {
      if ("item" in page.items) rows.push(...page.items.item);
    }
  }

  return rows;
}
