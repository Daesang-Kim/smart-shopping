import { BROWSABLE_ITEMS, type BrowsableItem } from "./catalog";
import type { ItemCategory } from "./kamisCatalog";

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

export interface MatchCandidate {
  name: string;
  category: ItemCategory;
  score: number; // 0~100, 높을수록 잘 맞음
  slug: string; // /item/[slug]로 바로 연결 가능 (처음 조회하는 품목이면 그 자리에서 캐싱됨)
}

function scoreEntry(entry: BrowsableItem, haystack: string): number {
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

// OCR 텍스트와 KAMIS 전체 품목 코드표(BROWSABLE_ITEMS)를 유사도 매칭해서 후보를 제시한다.
export function matchItemsFromText(ocrText: string): MatchCandidate[] {
  const haystack = clean(ocrText);

  const scored = BROWSABLE_ITEMS.map((entry) => ({ entry, score: scoreEntry(entry, haystack) }));

  // 동점일 땐 더 긴(구체적인) 이름을 우선한다 — 예: "양파" 안에 "파"가 부분 포함돼
  // 둘 다 100점이 나오는 경우, "양파"가 더 구체적인 정답이므로 앞에 와야 함.
  const sorted = scored.sort((a, b) => b.score - a.score || b.entry.name.length - a.entry.name.length);

  const candidates: MatchCandidate[] = [];
  for (const { entry, score } of sorted) {
    if (score < 40) continue;
    candidates.push({ name: entry.name, category: entry.category, score, slug: entry.slug });
    if (candidates.length >= 3) break;
  }

  return candidates;
}
