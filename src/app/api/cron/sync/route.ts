import { NextResponse } from "next/server";
import { syncAllActiveItems } from "@/lib/sync";

// Vercel Cron이 매일 이 엔드포인트를 호출한다 (vercel.json 참고).
// CRON_SECRET으로 보호해서, 외부에서 무단으로 호출해 KAMIS 호출량을 소모하는 것을 막는다.
// 고정된 MVP 목록이 아니라, 사용자가 조회해서 이미 DB에 쌓인 품목들만 갱신한다
// (품목 수가 늘어날수록 실행시간도 늘어나므로 maxDuration을 넉넉히 둠 — Hobby 플랜 상한인 60초로 설정).
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { results, errors } = await syncAllActiveItems();
  return NextResponse.json({ results, errors }, { status: errors.length > 0 ? 207 : 200 });
}
