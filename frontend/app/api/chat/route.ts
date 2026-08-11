import { NextResponse } from "next/server";
import { getBikeAccidentInsights } from "@/lib/data";
import { chatCompletionStream, type ChatMessage } from "@/lib/openrouter";
import type {
  BikeAccidentInsights,
  BikeBlackspotRow,
  BikeDistrictRow,
  BikeInsightBucket,
} from "@/lib/types";

function buildSystemPrompt(context: string) {
  return `당신은 서울시 자전거 피해 사고 인사이트 대시보드의 데이터 어시스턴트입니다.
- 아래 **제공 데이터**만 근거로 답하세요. 구별·심각도(사망/중상·경상·부상신고)·도로·시간대 질문이 오면 표에서 찾아 답하세요.
- 제공 표에 있는 항목을 "데이터 없음"이라고 하지 마세요.
- 심각률 = (사망사고+중상사고)/전체. 경상(slight)=사고내용 경상사고 건수. 부상신고(report)=부상신고사고 건수.
- 과장 없이, 짧고 구체적으로. 한국어 + 마크다운.
- 표본이 작은 구는 치사율이 불안정할 수 있음을 짧게 언급하세요.
- 추측·개인식별·공격적 내용 금지.

## 제공 데이터 (시 전체·전 기간 집계)
${context}`;
}

function fmtBuckets(rows: BikeInsightBucket[], limit = 12) {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `${r.key}: n=${r.n}, 비중=${r.share}%, 사망=${r.deaths}, 치사율=${r.fatalityPer1000}/1000, 심각률=${r.seriousRate}%`
    )
    .join("\n");
}

function districtLine(r: BikeDistrictRow) {
  const slight = r.slight ?? 0;
  const report = r.report ?? 0;
  const slightShare = r.slightShare ?? 0;
  return `${r.sgg}: n=${r.n}, 사망=${r.deaths}, 경상=${slight}(${slightShare}%), 부상신고=${report}, 치사율=${r.fatalityPer1000}/1000, 심각률=${r.seriousRate}%, 교차로=${r.crossShare}%, 고령=${r.elderlyShare}%, 화물=${r.truckShare}%, 자전거상대=${r.bikeShare}%`;
}

function fmtDistricts(rows: BikeDistrictRow[]) {
  const byFatality = [...rows].sort(
    (a, b) => b.fatalityPer1000 - a.fatalityPer1000 || b.n - a.n
  );
  const byN = [...rows].sort((a, b) => b.n - a.n);
  const bySlight = [...rows].sort(
    (a, b) => (b.slight ?? 0) - (a.slight ?? 0) || b.n - a.n
  );

  return [
    "### 자치구별 전체 (치사율 높은 순)",
    ...byFatality.map(districtLine),
    "",
    "### 자치구별 — 사고 건수 Top 10",
    ...byN.slice(0, 10).map(districtLine),
    "",
    "### 자치구별 — 경상사고 건수 Top 10",
    ...bySlight.slice(0, 10).map(districtLine),
  ].join("\n");
}

function fmtBlackspots(rows: BikeBlackspotRow[], limit = 20) {
  return rows
    .slice(0, limit)
    .map(
      (b, i) =>
        `${i + 1}. ${b.sgg} ${b.road}: n=${b.n}, 사망=${b.deaths}, 치사율=${b.fatalityPer1000}/1000, 심각률=${b.seriousRate}%`
    )
    .join("\n");
}

function buildInsightContext(insights: BikeAccidentInsights) {
  const {
    meta,
    headline,
    districts,
    blackspots,
    roadTypes,
    opponents,
    ages,
    hours,
    seasons,
    months,
    bikeRoadCompare,
    violations,
    dayHour,
  } = insights;

  const hourAll = [...hours].sort((a, b) => a.hour - b.hour);
  const hourTop = [...hours].sort((a, b) => b.n - a.n).slice(0, 8);
  const hourFatal = [...hours]
    .filter((h) => h.n >= 30)
    .sort((a, b) => b.fatalityPer1000 - a.fatalityPer1000)
    .slice(0, 8);

  // 요일×시간: 건수 Top만 (전체 dayHour는 큼)
  const dayHourTop = [...(dayHour ?? [])]
    .sort((a, b) => b.n - a.n)
    .slice(0, 15)
    .map(
      (c) =>
        `${c.day} ${c.hour}시: n=${c.n}, 사망=${c.deaths}, 치사율=${c.fatalityPer1000}/1000`
    )
    .join("\n");

  return [
    `출처: ${meta.source} · 기간: ${meta.period} · 전체 ${meta.total.toLocaleString()}건 · 사망 ${meta.deaths}명 · 자치구 ${meta.sggList?.length ?? districts.length}개`,
    "",
    "### 핵심 패턴 요약",
    `- 대형차: 사고 ${headline.heavyVehicleAccidentShare}% → 사망 ${headline.heavyVehicleDeathShare}%`,
    `- 고령: 사고 ${headline.elderlyAccidentShare}% → 사망 ${headline.elderlyDeathShare}%`,
    `- 새벽(05–07): 사고 ${headline.dawnAccidents}건 · 사망 ${headline.dawnDeaths} · 치사율 ${headline.dawnFatalityPer1000}/1000`,
    `- 전용도로 중 자전거-자전거 심각률 ${headline.bikeBikeSeriousRate}%`,
    `- 보행자 상대 ${headline.pedestrianCount.toLocaleString()}건 · 심각률 ${headline.pedestrianSeriousRate}% · 보도주행 비중 ${headline.sidewalkRidingShareOfPed}%`,
    "",
    fmtDistricts(districts),
    "",
    "### 블랙스팟 Top (반복사고 도로)",
    fmtBlackspots(blackspots),
    "",
    "### 도로형태",
    fmtBuckets(roadTypes),
    "",
    "### 상대차종",
    fmtBuckets(opponents, 12),
    "",
    "### 연령대",
    fmtBuckets(ages, 12),
    "",
    "### 법규위반",
    fmtBuckets([...violations].sort((a, b) => b.n - a.n), 12),
    "",
    "### 시간대 (0–23시 전체)",
    hourAll
      .map(
        (h) =>
          `${h.label}: n=${h.n}, 사망=${h.deaths}, 치사율=${h.fatalityPer1000}/1000, 심각률=${h.seriousRate}%`
      )
      .join("\n"),
    "",
    "### 시간대 — 건수 Top",
    hourTop
      .map((h) => `${h.label}: n=${h.n}, 치사율=${h.fatalityPer1000}/1000`)
      .join("\n"),
    "",
    "### 시간대 — 치사율 Top (n≥30)",
    hourFatal
      .map((h) => `${h.label}: n=${h.n}, 치사율=${h.fatalityPer1000}/1000`)
      .join("\n"),
    "",
    "### 요일×시간 핫스팟 Top 15",
    dayHourTop || "(없음)",
    "",
    "### 월별 건수",
    months.map((m) => `${m.month}월: ${m.n}건`).join(", "),
    "",
    "### 계절",
    fmtBuckets(seasons),
    "",
    "### 전용도로 위 vs 밖",
    fmtBuckets(bikeRoadCompare),
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
    ? buildInsightContext(insights)
    : "- (인사이트 데이터 없음 — 일반 교통안전 원칙으로만 답변. 구별 수치는 없다고 안내.)";

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
