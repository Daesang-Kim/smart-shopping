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
  // 지정하면 grdNm이 이 값과 일치하는 row만 사용한다 (소=등급별, 수입갈비냉동=원산지별로
  // 여러 row가 섞여서 오기 때문). 생략하면 응답에 값이 하나뿐인 품목이라는 뜻.
  grade?: string;
}
