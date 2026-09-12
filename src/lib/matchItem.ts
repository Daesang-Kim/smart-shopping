import { MVP_ITEMS } from "./items";
import { KAMIS_CATALOG, type CatalogEntry } from "./kamisCatalog";
import type { ItemCategory } from "./items";

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// OCR 결과 텍스트를 정리해서 공백 없이 이어붙인다 (가격표 줄바꿈 위치가 들쭉날쭉해서).
function clean(text: string): string {
  return text.replace(/\s/g, "");
}

// KAMIS 품목코드표(src/lib/kamisCatalog.ts) 전체와 대조하되, ctgryCode+itemCode가
// MVP_ITEMS와 일치하는 것만 "지원됨"으로 표시한다 — 그 외는 아직 상세화면(Supabase 캐시)이 없음.

export interface MatchCandidate {
  name: string;
  category: ItemCategory;
  score: number; // 0~100, 높을수록 잘 맞음
  slug: string | null; // 지원되는 품목이면 /item/[slug]로 연결 가능, 아니면 null
}

function scoreEntry(entry: CatalogEntry, haystack: string): number {
  if (haystack.includes(entry.name)) return 100;

  let bestDistance = Infinity;
  const windowSize = entry.name.length;
  for (let i = 0; i <= Math.max(0, haystack.length - windowSize); i++) {
    const window = haystack.slice(i, i + windowSize);
    const distance = levenshtein(entry.name, window);
    if (distance < bestDistance) bestDistance = distance;
  }
  if (haystack.length < windowSize) {
    bestDistance = Math.min(bestDistance, levenshtein(entry.name, haystack));
  }

  return Math.max(0, Math.round((1 - bestDistance / entry.name.length) * 100));
}

// OCR 텍스트와 KAMIS 전체 품목 코드표(123개)를 유사도 매칭해서 후보를 제시한다.
export function matchItemsFromText(ocrText: string): MatchCandidate[] {
  const haystack = clean(ocrText);

  const scored = KAMIS_CATALOG.map((entry) => ({ entry, score: scoreEntry(entry, haystack) }));

  const seenNames = new Set<string>();
  const candidates: MatchCandidate[] = [];
  // 동점일 땐 더 긴(구체적인) 이름을 우선한다 — 예: "양파" 안에 "파"가 부분 포함돼
  // 둘 다 100점이 나오는 경우, "양파"가 더 구체적인 정답이므로 앞에 와야 함.
  const sorted = scored.sort((a, b) => b.score - a.score || b.entry.name.length - a.entry.name.length);
  for (const { entry, score } of sorted) {
    if (score < 40 || seenNames.has(entry.name)) continue;
    seenNames.add(entry.name);

    const mvpItem = MVP_ITEMS.find(
      (item) =>
        item.sourceParams.ctgryCode === entry.ctgryCode &&
        item.sourceParams.itemCode === entry.itemCode,
    );

    candidates.push({
      name: entry.name,
      category: entry.category,
      score,
      slug: mvpItem?.id ?? null,
    });

    if (candidates.length >= 3) break;
  }

  return candidates;
}
