import { NextResponse } from "next/server";
import { generateCommentary, type CommentaryStats } from "@/lib/openrouter";

export async function POST(req: Request) {
  let stats: CommentaryStats;
  try {
    stats = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!stats?.trdar_cd_nm) {
    return NextResponse.json({ error: "상권 정보가 없습니다." }, { status: 400 });
  }

  try {
    const commentary = await generateCommentary(stats);
    return NextResponse.json({ commentary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "해설 생성 실패";
    return NextResponse.json({ error: `해설 생성 실패, 다시 시도해주세요. (${message})` }, { status: 502 });
  }
}
