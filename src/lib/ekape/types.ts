// 축산물품질평가원 "일자별 축산물소비자가격" API 응답 스키마
// 참고: docs/ekape-consumer-price-daily-spec.md (원본은 공식 OpenAPI 활용가이드 docx)

export interface EkapeItem {
  standYmd: string; // "YYYYMMDD" 또는 "평년"(평년가격 비교용 — 우리는 사용 안 함)
  itemCd: string;
  itemNm: string;
  judgeKind: string;
  judgeKindNm: string;
  grdNm: string;
  ntslPrc: string; // 평균가격(전국) — 문자열 숫자
  maxPrc: string;
  minPrc: string;
  unit: string; // 예: "원/100g"
}

export interface EkapeResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item: EkapeItem[] };
    };
  };
}

export interface EkapeQuery {
  judgeKind: string;
  itemCd: string;
}
