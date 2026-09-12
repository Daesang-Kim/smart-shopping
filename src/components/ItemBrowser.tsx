"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BROWSABLE_ITEMS, type BrowsableItem } from "@/lib/catalog";
import { resizeImageToBase64 } from "@/lib/resizeImage";
import { useFavorites } from "@/lib/useFavorites";

interface OcrCandidate {
  name: string;
  category: string;
  score: number;
  slug: string | null;
}

export default function ItemBrowser() {
  const [query, setQuery] = useState("");
  const [ocrCandidates, setOcrCandidates] = useState<OcrCandidate[] | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "loading" | "error">("idle");
  const [ocrError, setOcrError] = useState("");
  const { toggle, isFavorite } = useFavorites();

  // 정렬 우선순위: 즐겨찾기 > 지원되는(상세화면 있는) 품목 > 나머지.
  // "모두 표시"는 지키되, 실제로 눌러볼 수 있는 품목이 위로 오게 해서 목록이 쓸모 있게 함.
  const visibleItems = useMemo(() => {
    const trimmed = query.trim();
    const base = trimmed
      ? BROWSABLE_ITEMS.filter((item) => item.name.includes(trimmed))
      : BROWSABLE_ITEMS;

    return [...base].sort((a, b) => {
      const favA = isFavorite(a.key) ? 0 : 1;
      const favB = isFavorite(b.key) ? 0 : 1;
      if (favA !== favB) return favA - favB;
      const supA = a.slug ? 0 : 1;
      const supB = b.slug ? 0 : 1;
      return supA - supB;
    });
  }, [query, isFavorite]);

  async function handleFile(file: File) {
    setOcrStatus("loading");
    setOcrError("");
    try {
      const base64 = await resizeImageToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "인식 실패");

      setOcrCandidates(data.candidates ?? []);
      setQuery("");
      setOcrStatus("idle");
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "알 수 없는 오류");
      setOcrStatus("error");
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOcrCandidates(null);
          }}
          placeholder="품목 검색 (예: 배추, 대파...)"
          className="flex-1 bg-surface rounded-2xl px-4 py-3 text-ink placeholder:text-ink-dim shadow-lg outline-none"
        />
        <label className="bg-surface rounded-2xl w-12 h-12 flex items-center justify-center shadow-lg cursor-pointer hover:opacity-90 transition shrink-0">
          <span className="text-xl">📷</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {ocrStatus === "loading" && (
        <p className="text-surface/70 text-xs mb-2 px-1">사진 인식 중...</p>
      )}
      {ocrStatus === "error" && (
        <p className="text-expensive text-xs mb-2 px-1">인식 실패: {ocrError}</p>
      )}

      {ocrCandidates && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-surface/70 text-xs">촬영 인식 결과</span>
            <button
              onClick={() => setOcrCandidates(null)}
              className="text-surface/70 text-xs underline"
            >
              전체 목록으로
            </button>
          </div>
          {ocrCandidates.length === 0 ? (
            <p className="text-surface/70 text-xs px-1">
              일치하는 품목을 찾지 못했어요. 아래 목록에서 직접 골라주세요.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ocrCandidates.map((c) =>
                c.slug ? (
                  <Link
                    key={c.name}
                    href={`/item/${c.slug}`}
                    className="bg-cheap-soft rounded-xl px-4 py-2.5 flex items-center justify-between"
                  >
                    <span className="font-bold text-ink">{c.name}</span>
                    <span className="text-xs text-ink-dim">일치도 {c.score}%</span>
                  </Link>
                ) : (
                  <div
                    key={c.name}
                    className="bg-surface/60 rounded-xl px-4 py-2.5 flex items-center justify-between opacity-70"
                  >
                    <span className="font-bold text-ink-dim">{c.name}</span>
                    <span className="text-[11px] text-ink-dim">
                      일치도 {c.score}% · 아직 미지원 품목
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleItems.map((item) => (
          <ItemRow
            key={item.key}
            item={item}
            favorite={isFavorite(item.key)}
            onToggleFavorite={() => toggle(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  favorite,
  onToggleFavorite,
}: {
  item: BrowsableItem;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        {item.slug && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="text-lg leading-none"
            aria-label="즐겨찾기"
          >
            {favorite ? "⭐" : "☆"}
          </button>
        )}
        <span className={`font-bold text-lg ${item.slug ? "text-ink" : "text-ink-dim"}`}>
          {item.name}
        </span>
      </div>
      <span className="text-xs text-ink-dim">
        {item.category}
        {!item.slug && " · 미지원"}
      </span>
    </>
  );

  if (!item.slug) {
    return (
      <div className="bg-surface/60 rounded-2xl px-5 py-4 flex items-center justify-between opacity-60">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/item/${item.slug}`}
      className="bg-surface rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:opacity-90 transition"
    >
      {content}
    </Link>
  );
}
