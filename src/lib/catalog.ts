import { KAMIS_CATALOG, type ItemCategory } from "./kamisCatalog";

export interface BrowsableItem {
  slug: string; // `${ctgryCode}-${itemCode}` — URL 파라미터이자 DB items.slug로 그대로 씀
  ctgryCode: string;
  itemCode: string;
  name: string;
  category: ItemCategory;
}

// KAMIS 품목코드표 전체(123개)를 화면/URL에서 쓸 형태로 정규화한다.
// 모든 품목이 클릭 가능하다 — 처음 조회하는 품목은 그 자리에서 KAMIS를 호출해 캐싱하고
// (lib/sync.ts의 syncItem), 이후부터는 캐시를 읽으므로 빨라진다.
// 이름이 중복되는 코드(예: 브로콜리 261/280)는 첫 번째 것만 남긴다.
const seenNames = new Set<string>();
export const BROWSABLE_ITEMS: BrowsableItem[] = [];

for (const entry of KAMIS_CATALOG) {
  if (seenNames.has(entry.name)) continue;
  seenNames.add(entry.name);

  BROWSABLE_ITEMS.push({
    slug: `${entry.ctgryCode}-${entry.itemCode}`,
    ctgryCode: entry.ctgryCode,
    itemCode: entry.itemCode,
    name: entry.name,
    category: entry.category,
  });
}

export function findCatalogItem(slug: string): BrowsableItem | undefined {
  return BROWSABLE_ITEMS.find((item) => item.slug === slug);
}
