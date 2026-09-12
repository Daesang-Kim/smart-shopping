import { NextResponse } from "next/server";
import { BROWSABLE_ITEMS } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json({
    items: BROWSABLE_ITEMS.map(({ slug, name, category }) => ({ slug, name, category })),
  });
}
