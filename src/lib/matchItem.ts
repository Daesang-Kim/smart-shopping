import { MVP_ITEMS, type Item } from "./items";

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
  item: Item;
  score: number; // 0~100, 높을수록 잘 맞음
}

// OCR 텍스트와 MVP 품목명을 유사도 매칭해서 후보를 제시한다 (완전 자동 인식 실패에 대비).
export function matchItemsFromText(ocrText: string): MatchCandidate[] {
  const haystack = clean(ocrText);

  const candidates: MatchCandidate[] = MVP_ITEMS.map((item) => {
    if (haystack.includes(item.name)) {
      return { item, score: 100 };
    }

    // 품목명 길이만큼 슬라이딩 윈도우로 훑으며 가장 비슷한 구간을 찾는다.
    let bestDistance = Infinity;
    const windowSize = item.name.length;
    for (let i = 0; i <= Math.max(0, haystack.length - windowSize); i++) {
      const window = haystack.slice(i, i + windowSize);
      const distance = levenshtein(item.name, window);
      if (distance < bestDistance) bestDistance = distance;
    }
    if (haystack.length < windowSize) {
      bestDistance = Math.min(bestDistance, levenshtein(item.name, haystack));
    }

    const score = Math.max(0, Math.round((1 - bestDistance / item.name.length) * 100));
    return { item, score };
  });

  return candidates
    .filter((c) => c.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
