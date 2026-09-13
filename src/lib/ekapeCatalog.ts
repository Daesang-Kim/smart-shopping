// 축산물품질평가원 "일자별 축산물소비자가격" API가 제공하는 축종/품목코드.
// 공식 활용가이드에 명시적으로 나열된 것만 포함 (닭·계란은 품목코드 체계가
// 문서에 없어 제외 — 필요해지면 실제 호출로 확인 후 추가).
//
// grade: 같은 품목이라도 여러 구분값(grdNm)이 섞여서 오는 경우가 있어 실제
// 호출로 확인 후 등급/원산지별 별도 품목으로 분리했다. 실측 결과:
//   - 소 5개 부위: "1+등급"/"1등급" 두 가지가 항상 같이 옴 (가격 차이 큼)
//   - 수입갈비(냉동): "미국산"/"호주산" (grdNm은 등급 또는 원산지 둘 다 담는 필드)
//   - 그 외(돼지, 수입삼겹살, 수입갈비살냉장, 우유)는 값이 하나뿐이라 분리 불필요
export interface EkapeCatalogEntry {
  judgeKind: string; // 축종코드
  itemCd: string; // 품목코드
  name: string;
  grade?: string; // 지정 시 해당 grdNm 값과 일치하는 데이터만 사용
  gradeSlug?: string; // URL에 쓸 영문 슬러그 (grade의 한글을 그대로 쓰면 URL이 지저분해짐)
}

export const EKAPE_CATALOG: EkapeCatalogEntry[] = [
  // 소 — 등급별로 분리 (1+등급 vs 1등급 가격 차이가 큼)
  { judgeKind: "4301", itemCd: "21", name: "안심(1+등급)", grade: "1+등급", gradeSlug: "1plus" },
  { judgeKind: "4301", itemCd: "21", name: "안심(1등급)", grade: "1등급", gradeSlug: "1" },
  { judgeKind: "4301", itemCd: "22", name: "등심(1+등급)", grade: "1+등급", gradeSlug: "1plus" },
  { judgeKind: "4301", itemCd: "22", name: "등심(1등급)", grade: "1등급", gradeSlug: "1" },
  { judgeKind: "4301", itemCd: "36", name: "설도(1+등급)", grade: "1+등급", gradeSlug: "1plus" },
  { judgeKind: "4301", itemCd: "36", name: "설도(1등급)", grade: "1등급", gradeSlug: "1" },
  { judgeKind: "4301", itemCd: "40", name: "양지(1+등급)", grade: "1+등급", gradeSlug: "1plus" },
  { judgeKind: "4301", itemCd: "40", name: "양지(1등급)", grade: "1등급", gradeSlug: "1" },
  { judgeKind: "4301", itemCd: "50", name: "소갈비(1+등급)", grade: "1+등급", gradeSlug: "1plus" },
  { judgeKind: "4301", itemCd: "50", name: "소갈비(1등급)", grade: "1등급", gradeSlug: "1" },
  // 돼지 — 등급 구분 없음
  { judgeKind: "4304", itemCd: "25", name: "돼지 앞다리" },
  { judgeKind: "4304", itemCd: "27", name: "삼겹살" },
  { judgeKind: "4304", itemCd: "28", name: "돼지갈비" },
  { judgeKind: "4304", itemCd: "68", name: "목살" },
  // 수입 소고기 — 갈비(냉동)는 원산지별로 분리
  { judgeKind: "4401", itemCd: "31", name: "수입갈비(냉동, 미국산)", grade: "미국산", gradeSlug: "us" },
  { judgeKind: "4401", itemCd: "31", name: "수입갈비(냉동, 호주산)", grade: "호주산", gradeSlug: "au" },
  { judgeKind: "4401", itemCd: "37", name: "수입갈비살(냉장)" },
  // 수입 돼지고기
  { judgeKind: "4402", itemCd: "27", name: "수입삼겹살" },
  // 우유
  { judgeKind: "9908", itemCd: "01", name: "흰우유" },
];
