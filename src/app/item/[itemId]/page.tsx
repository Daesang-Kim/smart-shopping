import Link from "next/link";
import { notFound } from "next/navigation";
import { findItem } from "@/lib/items";
import { getPriceSummary } from "@/lib/priceSummary";
import { parseYyyymmdd, formatKoreanDate } from "@/lib/date";

function badgeColorClass(label: "비싼 편" | "저렴한 편" | "보통") {
  if (label === "비싼 편") return "bg-expensive-soft text-expensive";
  if (label === "저렴한 편") return "bg-cheap-soft text-cheap";
  return "bg-neutral/15 text-neutral";
}

function buildLinePoints(series: { date: string; price: number }[], width: number, height: number) {
  if (series.length < 2) return "";
  const prices = series.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  return series
    .map((d, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((d.price - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = findItem(itemId);
  if (!item) notFound();

  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof getPriceSummary>> | null = null;
  try {
    summary = await getPriceSummary(item);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";
  }

  return (
    <main className="flex-1 flex justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-surface/70 text-xs mb-3 inline-block">
          ← 목록으로
        </Link>

        {errorMessage || !summary ? (
          <div className="bg-surface rounded-2xl p-6 text-ink">
            데이터를 불러오지 못했습니다: {errorMessage}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl px-6 py-6 shadow-2xl">
            <div className="flex items-baseline justify-between mb-1">
              <h1 className="text-lg font-bold">{item.name}</h1>
              <span className="text-xs text-ink-dim">
                {summary.item.unit} 기준 · 소매가
              </span>
            </div>
            <p className="text-xs text-ink-dim mb-4">
              {formatKoreanDate(parseYyyymmdd(summary.today.date))} 조사 기준
            </p>

            <div className="text-center my-4">
              <span className="text-5xl font-black tabular-nums">
                {summary.today.price.toLocaleString()}
              </span>
              <span className="text-xl font-bold">원</span>
            </div>

            <div className="flex flex-col items-center gap-2 mb-6">
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${badgeColorClass(summary.percentile.label)}`}
              >
                최근 90일 중 상위 {summary.percentile.rankFromTopPct}% · {summary.percentile.label}
              </span>
              {summary.yoy && (
                <span className="px-3 py-1.5 rounded-full text-sm border border-ink/15">
                  작년 이맘때보다{" "}
                  {summary.yoy.changePct > 0 ? "+" : ""}
                  {summary.yoy.changePct}%
                </span>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-xs text-ink-dim mb-1">
                <span>최근 90일 가격대</span>
                <span className="font-bold text-ink">오늘</span>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-cheap via-neutral to-expensive">
                <div
                  className="absolute -top-1 w-1 h-4 bg-ink rounded"
                  style={{
                    left: `${
                      ((summary.today.price - summary.range90.min) /
                        (summary.range90.max - summary.range90.min || 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-ink-dim mt-1">
                <span>{summary.range90.min.toLocaleString()}원 · 최저</span>
                <span>{summary.range90.max.toLocaleString()}원 · 최고</span>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold mb-2">가격 추이 (최근 90일)</h2>
              <svg viewBox="0 0 320 120" className="w-full h-28">
                <polyline
                  points={buildLinePoints(summary.series90, 320, 120)}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={2}
                />
              </svg>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold mb-2">요일별 평균가 (최근 3개월)</h2>
              <div className="grid grid-cols-7 gap-1 items-end h-24">
                {(["월", "화", "수", "목", "금", "토", "일"] as const).map((day) => {
                  const isEstimated = day === "토" || day === "일";
                  const value = isEstimated
                    ? summary.weekday.estimated[day]
                    : summary.weekday.actual[day as "월" | "화" | "수" | "목" | "금"];
                  const allValues = [
                    ...Object.values(summary.weekday.actual),
                    ...Object.values(summary.weekday.estimated),
                  ];
                  const max = Math.max(...allValues);
                  const isCheapest = summary.weekday.cheapestDay === day;
                  return (
                    <div key={day} className="flex flex-col items-center justify-end h-full">
                      <div
                        className={`w-full rounded-t ${
                          isCheapest ? "bg-cheap" : "bg-ink/20"
                        } ${isEstimated ? "opacity-50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.2)_3px,rgba(0,0,0,0.2)_4px)]" : ""}`}
                        style={{ height: `${(value / max) * 100}%` }}
                      />
                      <span className="text-[10px] mt-1 text-ink-dim">{day}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-dim mt-2">
                토·일은 KAMIS가 조사하지 않아 금·월 평균으로 추정한 값이며, 실제 조사값이
                아닙니다.
              </p>
            </div>

            <div className="bg-cheap-soft rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-ink-dim mb-0.5">최근 90일 최저가</p>
              <p className="font-bold text-cheap">
                {summary.range90.min.toLocaleString()}원 ·{" "}
                {formatKoreanDate(parseYyyymmdd(summary.range90.minDate))}
              </p>
            </div>

            <p className="text-[11px] text-ink-dim border-t border-rule pt-3">
              KAMIS 소매가격 기준 · 주말·공휴일은 조사하지 않아 추이·요일 비교에서
              제외/추정 처리됨
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
