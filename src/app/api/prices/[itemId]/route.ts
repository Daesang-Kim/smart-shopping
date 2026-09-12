import { NextResponse } from "next/server";
import { findCatalogItem } from "@/lib/catalog";
import { getPriceSummary } from "@/lib/priceSummary";

// 처음 조회하는 품목은 이 자리에서 KAMIS 라이브 호출 + Supabase 저장까지 하므로
// 기본 함수 제한시간(짧음)보다 여유를 둔다.
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const item = findCatalogItem(itemId);
  if (!item) {
    return NextResponse.json({ error: "품목을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const summary = await getPriceSummary(item);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
