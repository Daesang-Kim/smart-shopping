import { KAMIS_CATALOG, type ItemCategory } from "./kamisCatalog";
import { EKAPE_CATALOG } from "./ekapeCatalog";

export interface KamisBrowsableItem {
  slug: string;
  name: string;
  category: ItemCategory;
  source: "kamis";
  ctgryCode: string;
  itemCode: string;
}

export interface EkapeBrowsableItem {
  slug: string;
  name: string;
  category: ItemCategory;
  source: "ekape";
  judgeKind: string;
  itemCd: string;
  grade?: string; // 지정 시 grdNm이 이 값과 일치하는 데이터만 사용 (등급/원산지 구분)
}

export type BrowsableItem = KamisBrowsableItem | EkapeBrowsableItem;

// KAMIS 품목코드표(농산물+수산물) + 축평원 코드표(축산물)를 하나의 목록으로 합친다.
// 이름이 중복되는 코드(예: 브로콜리 261/280)는 첫 번째 것만 남긴다.
const seenNames = new Set<string>();
export const BROWSABLE_ITEMS: BrowsableItem[] = [];

for (const entry of KAMIS_CATALOG) {
  if (seenNames.has(entry.name)) continue;
  seenNames.add(entry.name);

  BROWSABLE_ITEMS.push({
    slug: `${entry.ctgryCode}-${entry.itemCode}`,
    name: entry.name,
    category: entry.category,
    source: "kamis",
    ctgryCode: entry.ctgryCode,
    itemCode: entry.itemCode,
  });
}

for (const entry of EKAPE_CATALOG) {
  if (seenNames.has(entry.name)) continue;
  seenNames.add(entry.name);

  const slug = entry.gradeSlug
    ? `ekape-${entry.judgeKind}-${entry.itemCd}-${entry.gradeSlug}`
    : `ekape-${entry.judgeKind}-${entry.itemCd}`;

  BROWSABLE_ITEMS.push({
    slug,
    name: entry.name,
    category: "축산물",
    source: "ekape",
    judgeKind: entry.judgeKind,
    itemCd: entry.itemCd,
    grade: entry.grade,
  });
}

export function findCatalogItem(slug: string): BrowsableItem | undefined {
  return BROWSABLE_ITEMS.find((item) => item.slug === slug);
}
