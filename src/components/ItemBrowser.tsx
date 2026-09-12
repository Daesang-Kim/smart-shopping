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
  slug: string;
}

export default function ItemBrowser() {
  const [query, setQuery] = useState("");
  const [ocrCandidates, setOcrCandidates] = useState<OcrCandidate[] | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "loading" | "error">("idle");
  const [ocrError, setOcrError] = useState("");
  const { toggle, isFavorite } = useFavorites();

  // 즐겨찾기한 품목만 위로 올리고, 나머지는 원래 카탈로그 순서 그대로 둔다.
  const visibleItems = useMemo(() => {
    const trimmed = query.trim();
    const base = trimmed
      ? BROWSABLE_ITEMS.filter((item) => item.name.includes(trimmed))
      : BROWSABLE_ITEMS;

    return [...base].sort((a, b) => {
      const favA = isFavorite(a.slug) ? 0 : 1;
      const favB = isFavorite(b.slug) ? 0 : 1;
      return favA - favB;
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
              {ocrCandidates.map((c) => (
                <Link
                  key={c.slug}
                  href={`/item/${c.slug}`}
                  className="bg-cheap-soft rounded-xl px-4 py-2.5 flex items-center justify-between"
                >
                  <span className="font-bold text-ink">{c.name}</span>
                  <span className="text-xs text-ink-dim">일치도 {c.score}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleItems.map((item) => (
          <ItemRow
            key={item.slug}
            item={item}
            favorite={isFavorite(item.slug)}
            onToggleFavorite={() => toggle(item.slug)}
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
  return (
    <Link
      href={`/item/${item.slug}`}
      className="bg-surface rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:opacity-90 transition"
    >
      <div className="flex items-center gap-2">
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
        <span className="font-bold text-lg text-ink">{item.name}</span>
      </div>
      <span className="text-xs text-ink-dim">{item.category}</span>
    </Link>
  );
}
