import { NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/ocr";
import { matchItemsFromText } from "@/lib/matchItem";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const base64Image: string | undefined = body?.image;

  if (!base64Image) {
    return NextResponse.json({ error: "image가 필요합니다." }, { status: 400 });
  }

  try {
    const text = await extractTextFromImage(base64Image);
    const candidates = matchItemsFromText(text).map(({ item, score }) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      score,
    }));

    return NextResponse.json({ text, candidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
