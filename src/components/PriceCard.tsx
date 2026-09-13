"use client";

import { useState } from "react";
import type { PriceSummary, PriceType } from "@/lib/priceSummary";
import { CHART_FUTURE_DAYS, CHART_PAST_DAYS, type ChartHolidayMarker, type ChartPoint } from "@/lib/stats";
import { parseYyyymmdd, formatKoreanDate } from "@/lib/date";
import { useFavorites } from "@/lib/useFavorites";

function badgeColorClass(label: "비싼 편" | "저렴한 편" | "보통") {
  if (label === "비싼 편") return "bg-expensive-soft text-expensive";
  if (label === "저렴한 편") return "bg-cheap-soft text-cheap";
  return "bg-neutral/15 text-neutral";
}

const CHART_WIDTH = 320;
const LABEL_AREA = 16; // 상단 명절 라벨 공간
const BOTTOM_LABEL_AREA = 12; // 하단 "오늘" 라벨 공간
const PLOT_HEIGHT = 114;
const CHART_HEIGHT = LABEL_AREA + PLOT_HEIGHT + BOTTOM_LABEL_AREA;
const X_MIN = -CHART_PAST_DAYS;
const X_MAX = CHART_FUTURE_DAYS;

function mapX(offsetDays: number): number {
  return ((offsetDays - X_MIN) / (X_MAX - X_MIN)) * CHART_WIDTH;
}

function buildPolyline(points: ChartPoint[], yMin: number, yMax: number): string {
  if (points.length < 2) return "";
  const ySpan = yMax - yMin || 1;
  return [...points]
    .sort((a, b) => a.offsetDays - b.offsetDays)
    .map((p) => {
      const x = mapX(p.offsetDays);
      const y = LABEL_AREA + PLOT_HEIGHT - ((p.price - yMin) / ySpan) * PLOT_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function mapY(price: number, yMin: number, yMax: number): number {
  const ySpan = yMax - yMin || 1;
  return LABEL_AREA + PLOT_HEIGHT - ((price - yMin) / ySpan) * PLOT_HEIGHT;
}

function HolidayMarker({ marker, color }: { marker: ChartHolidayMarker; color: string }) {
  const x = mapX(marker.offsetDays);
  const date = parseYyyymmdd(marker.date);
  return (
    <g>
      <line
        x1={x}
        y1={LABEL_AREA}
        x2={x}
        y2={LABEL_AREA + PLOT_HEIGHT}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2,2"
      />
      <text x={x} y={10} fontSize={8} fill={color} textAnchor="middle">
        {marker.name} {date.getMonth() + 1}/{date.getDate()}
      </text>
    </g>
  );
}

// "오늘"이 그래프 어디쯤인지 표시 — 실선이 오늘(offsetDays=0)에서 끝나는데
// 시각적 표시가 없으면 어디까지가 실측이고 오늘이 정확히 어딘지 알기 어려워서 추가.
function TodayMarker({ y }: { y: number }) {
  const x = mapX(0);
  return (
    <g>
      <line
        x1={x}
        y1={LABEL_AREA}
        x2={x}
        y2={LABEL_AREA + PLOT_HEIGHT}
        stroke="var(--ink)"
        strokeWidth={1}
        strokeDasharray="1,2"
        opacity={0.4}
      />
      <circle cx={x} cy={y} r={3} fill="var(--ink)" />
      <text
        x={x}
        y={LABEL_AREA + PLOT_HEIGHT + 10}
        fontSize={8}
        fill="var(--ink)"
        fontWeight="bold"
        textAnchor="middle"
      >
        오늘
      </text>
    </g>
  );
}

export default function PriceCard({
  itemId,
  itemName,
  initialSummary,
}: {
  itemId: string;
  itemName: string;
  initialSummary: PriceSummary;
}) {
  const [priceType, setPriceType] = useState<PriceType>("retail");
  const [summaries, setSummaries] = useState<Partial<Record<PriceType, PriceSummary>>>({
    retail: initialSummary,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();

  const summary = summaries[priceType];

  const chartPrices = summary
    ? [...summary.chart.thisYear, ...summary.chart.lastYear].map((p) => p.price)
    : [];
  const chartYMin = chartPrices.length ? Math.min(...chartPrices) : 0;
  const chartYMax = chartPrices.length ? Math.max(...chartPrices) : 1;

  async function handleToggle(next: PriceType) {
    setPriceType(next);
    if (summaries[next]) return; // 이미 이번 방문에서 불러온 적 있으면 재요청 없음

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/prices/${itemId}?priceType=${next}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패");
      setSummaries((prev) => ({ ...prev, [next]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  // 축평원(축산물) 품목은 소매/도매 구분 없이 소비자가격 하나만 제공하므로 토글 자체를 숨긴다.
  const supportsWholesale = initialSummary.item.source === "kamis";

  return (
    <div className="bg-surface rounded-2xl px-6 py-6 shadow-2xl">
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggleFavorite(itemId)}
            className="text-lg leading-none"
            aria-label="즐겨찾기"
          >
            {isFavorite(itemId) ? "⭐" : "☆"}
          </button>
          <h1 className="text-lg font-bold">{itemName}</h1>
        </div>
        {supportsWholesale && (
          <div className="flex rounded-full bg-ink/10 p-0.5 text-[11px]">
            {(["retail", "wholesale"] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleToggle(type)}
                className={`px-2.5 py-1 rounded-full transition ${
                  priceType === type ? "bg-surface text-ink font-bold shadow" : "text-ink-dim"
                }`}
              >
                {type === "retail" ? "소매가" : "도매가"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!summary && loading && (
        <p className="text-ink-dim text-sm py-10 text-center">불러오는 중...</p>
      )}
      {!summary && error && (
        <p className="text-expensive text-sm py-10 text-center">
          {priceType === "wholesale" ? "도매가" : "소매가"} 데이터를 가져오지 못했어요: {error}
        </p>
      )}

      {summary && (
        <>
          <p className="text-xs text-ink-dim mb-4">
            {summary.item.unit} 기준 · {formatKoreanDate(parseYyyymmdd(summary.today.date))} 조사
            기준
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
                작년 이맘때보다 {summary.yoy.changePct > 0 ? "+" : ""}
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

          <div className="mb-2">
            <h2 className="text-sm font-bold mb-2">가격 추이 (최근 90일 · 작년 비교)</h2>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-32">
              {summary.chart.holidaysLastYear.map((h) => (
                <HolidayMarker key={`ly-${h.name}`} marker={h} color="var(--ink-dim)" />
              ))}
              {summary.chart.holidaysThisYear.map((h) => (
                <HolidayMarker key={`ty-${h.name}`} marker={h} color="var(--expensive)" />
              ))}
              <polyline
                points={buildPolyline(summary.chart.lastYear, chartYMin, chartYMax)}
                fill="none"
                stroke="var(--ink-dim)"
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <polyline
                points={buildPolyline(summary.chart.thisYear, chartYMin, chartYMax)}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
              />
              <TodayMarker y={mapY(summary.today.price, chartYMin, chartYMax)} />
            </svg>
            <div className="flex items-center gap-3 text-[10px] text-ink-dim mt-1">
              <span>― 올해(실측)</span>
              <span>┄ 작년(참고용)</span>
              <span className="text-expensive">┊ 올해 명절</span>
              <span>┊ 작년 명절</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-sm font-bold mb-2">요일별 평균가 (최근 3개월)</h2>
            <div className="grid grid-cols-7 gap-1 items-end h-24">
              {(() => {
                const allValues = [
                  ...Object.values(summary.weekday.actual),
                  summary.weekday.weekend.토.value,
                  summary.weekday.weekend.일.value,
                ];
                const max = Math.max(...allValues);
                const min = Math.min(...allValues);
                const range = max - min || 1;
                // 요일별 가격 차이가 원래 작은 품목(우유, 축산물 등)은 0부터 시작하는
                // 막대 그래프로 그리면 다 거의 꽉 찬 높이로 보여서 차이가 안 보인다
                // ("표시가 안 되는 버그"로 오인하기 쉬움) — 최저가를 바닥(20%)에,
                // 최고가를 꼭대기(100%)에 두고 그 사이를 늘려서 상대적 차이를 부각한다.
                const MIN_HEIGHT_PCT = 20;
                const heightPct = (value: number) =>
                  MIN_HEIGHT_PCT + ((value - min) / range) * (100 - MIN_HEIGHT_PCT);

                return (["월", "화", "수", "목", "금", "토", "일"] as const).map((day) => {
                  const isWeekend = day === "토" || day === "일";
                  const weekendInfo = isWeekend ? summary.weekday.weekend[day as "토" | "일"] : null;
                  const isEstimated = weekendInfo?.estimated ?? false;
                  const value = weekendInfo
                    ? weekendInfo.value
                    : summary.weekday.actual[day as "월" | "화" | "수" | "목" | "금"];
                  const isCheapest = summary.weekday.cheapestDay === day;
                  return (
                    <div key={day} className="flex flex-col items-center justify-end h-full">
                      <div
                        className={`w-full rounded-t ${
                          isCheapest ? "bg-cheap" : "bg-ink/20"
                        } ${isEstimated ? "opacity-50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.2)_3px,rgba(0,0,0,0.2)_4px)]" : ""}`}
                        style={{ height: `${heightPct(value)}%` }}
                      />
                      <span className="text-[10px] mt-1 text-ink-dim">{day}</span>
                    </div>
                  );
                });
              })()}
            </div>
            {(summary.weekday.weekend.토.estimated || summary.weekday.weekend.일.estimated) && (
              <p className="text-[11px] text-ink-dim mt-2">
                토·일은 조사하지 않아 금·월 평균으로 추정한 값이며, 실제 조사값이 아닙니다.
              </p>
            )}
          </div>

          <div className="bg-cheap-soft rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-ink-dim mb-0.5">최근 90일 최저가</p>
            <p className="font-bold text-cheap">
              {summary.range90.min.toLocaleString()}원 ·{" "}
              {formatKoreanDate(parseYyyymmdd(summary.range90.minDate))}
            </p>
          </div>

          <p className="text-[11px] text-ink-dim border-t border-rule pt-3">
            {summary.item.source === "ekape"
              ? "축산물품질평가원 소비자가격 기준 · 주말에도 조사되어 요일 비교에 실제값을 사용함(공휴일 등 일부는 없을 수 있음)"
              : `KAMIS ${priceType === "wholesale" ? "중도매(도매)가격" : "소매가격"} 기준 · 주말·공휴일은 조사하지 않아 추이·요일 비교에서 제외/추정 처리됨`}
          </p>
        </>
      )}
    </div>
  );
}
