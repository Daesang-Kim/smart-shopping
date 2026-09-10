import Link from "next/link";
import { MVP_ITEMS } from "@/lib/items";

export default function HomePage() {
  return (
    <main className="flex-1 flex justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-surface/70 text-xs tracking-wide mb-3 px-1">
          오늘 이 가격, 싼 걸까? · MVP 품목 목록 (검색/OCR은 추후 추가)
        </p>
        <div className="flex flex-col gap-3">
          {MVP_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              className="bg-surface rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:opacity-90 transition"
            >
              <span className="text-ink font-bold text-lg">{item.name}</span>
              <span className="text-ink-dim text-xs">{item.category}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
