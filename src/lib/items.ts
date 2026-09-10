// MVP 품목 마스터 (docs/db-schema.sql의 items 테이블과 동일한 개념)
// 아직 DB가 없어서 코드에 하드코딩 — Supabase 연결 후 items 테이블로 이전 예정.

export type ItemCategory = "농산물" | "수산물" | "축산물";
export type PriceSource = "kamis" | "ekape";

export interface KamisSourceParams {
  ctgryCode: string; // 부류코드
  itemCode: string; // 품목코드
}

export interface Item {
  id: string; // 내부 슬러그, 예: "napa-cabbage"
  name: string; // 표시명
  category: ItemCategory;
  source: PriceSource;
  sourceParams: KamisSourceParams;
}

// 부류코드: 100 식량작물, 200 채소류, 300 특용작물, 400 과일류, 500 축산물(KAMIS 미제공), 600 수산물
export const MVP_ITEMS: Item[] = [
  {
    id: "napa-cabbage",
    name: "배추",
    category: "농산물",
    source: "kamis",
    sourceParams: { ctgryCode: "200", itemCode: "211" },
  },
  {
    id: "onion",
    name: "양파",
    category: "농산물",
    source: "kamis",
    sourceParams: { ctgryCode: "200", itemCode: "245" },
  },
  {
    id: "green-onion",
    name: "대파",
    category: "농산물",
    source: "kamis",
    sourceParams: { ctgryCode: "200", itemCode: "246" },
  },
  {
    id: "radish",
    name: "무",
    category: "농산물",
    source: "kamis",
    sourceParams: { ctgryCode: "200", itemCode: "231" },
  },
  {
    id: "mackerel",
    name: "고등어",
    category: "수산물",
    source: "kamis",
    sourceParams: { ctgryCode: "600", itemCode: "611" },
  },
];

export function findItem(id: string): Item | undefined {
  return MVP_ITEMS.find((item) => item.id === id);
}
