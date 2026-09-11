import { NextResponse } from "next/server";
import { syncAllItems } from "@/lib/sync";

// Vercel Cron이 매일 이 엔드포인트를 호출한다 (vercel.json 참고).
// CRON_SECRET으로 보호해서, 외부에서 무단으로 호출해 KAMIS 호출량을 소모하는 것을 막는다.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { results, errors } = await syncAllItems();
  return NextResponse.json({ results, errors }, { status: errors.length > 0 ? 207 : 200 });
}
