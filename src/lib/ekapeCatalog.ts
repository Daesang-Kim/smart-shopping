// 축산물품질평가원 "일자별 축산물소비자가격" API가 제공하는 축종/품목코드.
// 공식 활용가이드에 명시적으로 나열된 것만 포함 (닭·계란은 품목코드 체계가
// 문서에 없어 제외 — 필요해지면 실제 호출로 확인 후 추가).
export interface EkapeCatalogEntry {
  judgeKind: string; // 축종코드
  itemCd: string; // 품목코드
  name: string;
}

export const EKAPE_CATALOG: EkapeCatalogEntry[] = [
  // 소
  { judgeKind: "4301", itemCd: "21", name: "안심" },
  { judgeKind: "4301", itemCd: "22", name: "등심" },
  { judgeKind: "4301", itemCd: "36", name: "설도" },
  { judgeKind: "4301", itemCd: "40", name: "양지" },
  { judgeKind: "4301", itemCd: "50", name: "소갈비" },
  // 돼지
  { judgeKind: "4304", itemCd: "25", name: "돼지 앞다리" },
  { judgeKind: "4304", itemCd: "27", name: "삼겹살" },
  { judgeKind: "4304", itemCd: "28", name: "돼지갈비" },
  { judgeKind: "4304", itemCd: "68", name: "목살" },
  // 수입 소고기
  { judgeKind: "4401", itemCd: "31", name: "수입갈비(냉동)" },
  { judgeKind: "4401", itemCd: "37", name: "수입갈비살(냉장)" },
  // 수입 돼지고기
  { judgeKind: "4402", itemCd: "27", name: "수입삼겹살" },
  // 우유
  { judgeKind: "9908", itemCd: "01", name: "흰우유" },
];
