import { NextResponse } from "next/server";
import { getBikeAccidentInsights } from "@/lib/data";
import { chatCompletionStream, type ChatMessage } from "@/lib/openrouter";

function buildSystemPrompt(context: string) {
  return `당신은 서울시 자전거 교통사고 데이터를 바탕으로 해결 방안을 제안하는 안전 정책 어시스턴트입니다.
- 과장 없이, 아래 개입 방향·수치에 근거해 짧고 구체적으로 답하세요.
- 한국어로 답하고, 마크다운(불릿·굵게·짧은 소제목)을 적절히 쓰세요.
- 확실하지 않은 수치는 추측하지 말고 방향을 제안하세요.
- 개인 식별·공격적 내용은 다루지 마세요.

## 개입 방향 요약 (시 전체·전 기간 패턴)
${context}`;
}

function interventionContext(
  headline: NonNullable<Awaited<ReturnType<typeof getBikeAccidentInsights>>>["headline"]
) {
  return [
    `- 대형차 사망: 사고 ${headline.heavyVehicleAccidentShare}% → 사망 ${headline.heavyVehicleDeathShare}% → 물류·공사 동선 분리, 우회전 안전`,
    `- 고령 사망: 사고 ${headline.elderlyAccidentShare}% → 사망 ${headline.elderlyDeathShare}% → 생활권 교차로·저속화`,
    `- 교차로 치명 / 단일로 다발 → 신호·회전 속도·횡단보도 우선 / 자전거도로 분리·노면 표시`,
    `- 보도 충돌: 보행자 ${headline.pedestrianCount.toLocaleString()}건 (보도주행 비중 ${headline.sidewalkRidingShareOfPed}%) → 차도측 자전거 공간`,
    `- 전용도로 중상: 심각률 ${headline.bikeBikeSeriousRate}% → 폭·일방화·속도 관리`,
    `- 새벽 사망: 05–07 치사율 ${headline.dawnFatalityPer1000} → 화물축 조명·분리`,
    `- 중앙선침범 등 고치사 위반 → 단일로 중앙분리·과속 억제`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const incoming = body.messages ?? [];
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "메시지가 없습니다." }, { status: 400 });
  }

  const insights = await getBikeAccidentInsights();
  const context = insights
    ? interventionContext(insights.headline)
    : "- (인사이트 데이터 없음 — 일반 교통안전 원칙으로 답변)";

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...incoming
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
  ];

  if (messages.length < 2) {
    return NextResponse.json({ error: "유효한 사용자 메시지가 없습니다." }, { status: 400 });
  }

  try {
    const stream = await chatCompletionStream(messages);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "채팅 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
