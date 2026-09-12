"use client";

import { useState } from "react";
import Link from "next/link";

interface Candidate {
  id: string;
  name: string;
  category: string;
  score: number;
}

const MAX_DIMENSION = 1024; // Vision API엔 이 정도 해상도로 충분하고, 업로드 용량도 줄어듦

function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context 생성 실패"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl.split(",")[1]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function OcrSearch() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleFile(file: File) {
    setStatus("loading");
    setErrorMessage("");
    try {
      const base64 = await resizeImageToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "인식 실패");

      setCandidates(data.candidates ?? []);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류");
      setStatus("error");
    }
  }

  return (
    <div className="mb-4">
      <label className="bg-surface rounded-2xl px-5 py-4 flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:opacity-90 transition">
        <span className="text-ink font-bold">📷 가격표 촬영으로 찾기</span>
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

      {status === "loading" && (
        <p className="text-surface/70 text-xs mt-2 px-1">인식 중...</p>
      )}

      {status === "error" && (
        <p className="text-expensive text-xs mt-2 px-1">인식 실패: {errorMessage}</p>
      )}

      {status === "done" && (
        <div className="mt-2 flex flex-col gap-2">
          {candidates.length === 0 ? (
            <p className="text-surface/70 text-xs px-1">
              일치하는 품목을 찾지 못했어요. 아래 목록에서 직접 골라주세요.
            </p>
          ) : (
            candidates.map((c) => (
              <Link
                key={c.id}
                href={`/item/${c.id}`}
                className="bg-cheap-soft rounded-xl px-4 py-2.5 flex items-center justify-between"
              >
                <span className="font-bold text-ink">{c.name}</span>
                <span className="text-xs text-ink-dim">일치도 {c.score}%</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
