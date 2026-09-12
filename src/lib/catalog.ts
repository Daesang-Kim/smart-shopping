import type { ItemCategory } from "./items";
import { MVP_ITEMS } from "./items";
import { KAMIS_CATALOG } from "./kamisCatalog";

export interface BrowsableItem {
  key: string; // `${ctgryCode}:${itemCode}` — 즐겨찾기/리스트 키로 사용하는 고유 식별자
  name: string;
  category: ItemCategory;
  slug: string | null; // MVP_ITEMS에 있으면 /item/[slug]로 이동 가능, 없으면 아직 미지원
}

// KAMIS 품목코드표 전체(123개)를 화면에 보여줄 형태로 정규화한다.
// 이름이 중복되는 코드(예: 브로콜리 261/280)는 첫 번째 것만 남긴다.
const seenNames = new Set<string>();
export const BROWSABLE_ITEMS: BrowsableItem[] = [];

for (const entry of KAMIS_CATALOG) {
  if (seenNames.has(entry.name)) continue;
  seenNames.add(entry.name);

  const mvpItem = MVP_ITEMS.find(
    (item) =>
      item.sourceParams.ctgryCode === entry.ctgryCode &&
      item.sourceParams.itemCode === entry.itemCode,
  );

  BROWSABLE_ITEMS.push({
    key: `${entry.ctgryCode}:${entry.itemCode}`,
    name: entry.name,
    category: entry.category,
    slug: mvpItem?.id ?? null,
  });
}
