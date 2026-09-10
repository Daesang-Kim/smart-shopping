import { NextResponse } from "next/server";
import { MVP_ITEMS } from "@/lib/items";

export async function GET() {
  return NextResponse.json({
    items: MVP_ITEMS.map(({ id, name, category }) => ({ id, name, category })),
  });
}
