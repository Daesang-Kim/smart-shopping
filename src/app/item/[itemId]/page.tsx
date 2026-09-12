import Link from "next/link";
import { notFound } from "next/navigation";
import { findCatalogItem } from "@/lib/catalog";
import { getPriceSummary } from "@/lib/priceSummary";
import PriceCard from "@/components/PriceCard";

// 처음 조회하는 품목은 이 자리에서 KAMIS 라이브 호출 + Supabase 저장까지 하므로
// 기본 함수 제한시간(짧음)보다 여유를 둔다.
export const maxDuration = 60;

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = findCatalogItem(itemId);
  if (!item) notFound();

  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof getPriceSummary>> | null = null;
  try {
    summary = await getPriceSummary(item, "retail");
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
          <PriceCard itemId={item.slug} itemName={item.name} initialSummary={summary} />
        )}
      </div>
    </main>
  );
}
