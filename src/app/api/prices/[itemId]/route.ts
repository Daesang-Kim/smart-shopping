import { NextResponse } from "next/server";
import { findItem } from "@/lib/items";
import { getPriceSummary } from "@/lib/priceSummary";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const item = findItem(itemId);
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
