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

async function fetchPage(query: KamisQuery, pageNo: number) {
  const res = await fetch(buildUrl(query, pageNo));
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

// KAMIS는 날짜당 여러 시장(mrkt_cd)의 조사값을 개별 row로 반환하므로,
// 기간이 길면 totalCount가 numOfRows(최대 1000)를 넘어 페이지네이션이 필요하다.
// (임시: DB 캐싱 전까지는 매 요청마다 라이브 호출하므로, 남은 페이지를 병렬로 가져와 지연을 줄인다.
//  Supabase 연동 후에는 이 호출이 cron 배치로 옮겨가고 앱은 DB만 읽으므로 이 최적화 자체가 불필요해진다.)
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
