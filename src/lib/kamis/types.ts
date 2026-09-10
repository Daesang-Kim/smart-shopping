// data.go.kr B552845/perDay/price 응답 스키마
// 참고: docs/kamis-perday-api-spec.md

export interface KamisRawRow {
  exmn_ymd: string; // 조사일자 YYYYMMDD
  se_cd: string; // 구분코드 (01=소매)
  se_nm: string;
  ctgry_cd: string; // 부류코드
  ctgry_nm: string;
  item_cd: string; // 품목코드
  item_nm: string;
  vrty_cd: string; // 품종코드
  vrty_nm: string;
  grd_cd: string; // 등급코드
  grd_nm: string;
  sgg_cd: string; // 시군구코드
  sgg_nm: string;
  unit: string;
  unit_sz: string;
  mrkt_cd: string; // 시장코드
  mrkt_nm: string;
  exmn_dd_prc: string; // 조사일가격 (문자열 숫자)
  exmn_dd_cnvs_prc: string; // 조사일 kg환산가격
  orgnl_reg_dt: string;
}

export interface KamisApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      numOfRows: number;
      pageNo: number;
      totalCount: number;
      dataType: string;
      items: { item: KamisRawRow[] } | Record<string, never>;
    };
  };
}

export interface KamisQuery {
  ctgryCode: string; // 부류코드
  itemCode: string; // 품목코드
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  seCode?: string; // 구분코드, 기본 "01" (소매)
}
