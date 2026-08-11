export interface CommentaryStats {
  trdar_cd_nm: string;
  trdar_se_cd_nm: string;
  svc_induty_cd_nm: string;
  half_life_status: string;
  half_life_months: number | null;
  half_life_lower_bound_quarters: number | null;
  pct_20s: number | null;
  clsbiz_rt: number | null;
}

export function buildPrompt(stats: CommentaryStats): string {
  const pct20 = stats.pct_20s !== null ? `${Math.round(stats.pct_20s * 100)}%` : "정보 없음";
  const halfLife =
    stats.half_life_status === "ok" && stats.half_life_months !== null
      ? `${stats.half_life_months}개월`
      : stats.half_life_status === "censored"
        ? `관측 기간(최소 ${(stats.half_life_lower_bound_quarters ?? 0) * 3}개월+) 내 아직 절반으로 꺾이지 않음`
        : "뚜렷한 매출 피크가 관측되지 않음";
  const clsbiz =
    stats.clsbiz_rt !== null ? `${stats.clsbiz_rt.toFixed(1)}%` : "정보 없음";

  return `당신은 서울 상권 데이터 분석 결과를 창업 예정자에게 쉽게 설명하는 애널리스트입니다.
아래 통계를 바탕으로, 이 상권/업종이 왜 이런 반감기 패턴을 보이는지 2~3문장의 한국어로 자연스럽게 설명하세요.
과장하지 말고 주어진 수치에 근거해서만 설명하세요.

- 상권명: ${stats.trdar_cd_nm} (${stats.trdar_se_cd_nm})
- 업종: ${stats.svc_induty_cd_nm}
- 20대 유동인구 비율: ${pct20}
- 반감기: ${halfLife}
- 폐업률: ${clsbiz}

예시 스타일: "이 상권은 20대 유동인구 비율이 68%로 높고, 디저트 업종 비중이 커서 반감기가 3개월로 짧게 나타났습니다."`;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function openRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    "X-Title": "Seoul Bike Safety",
  };
}

function resolveModel() {
  return process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";
}

async function openRouterChat(
  messages: ChatMessage[],
  maxTokens = 800
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: resolveModel(),
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter 요청 실패 (${res.status}): ${body}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter 응답에 내용이 없습니다.");
  }
  return content as string;
}

/** OpenRouter SSE → 순수 텍스트 ReadableStream */
export async function chatCompletionStream(
  messages: ChatMessage[],
  maxTokens = 1200
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: resolveModel(),
      messages,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter 요청 실패 (${res.status}): ${body}`);
  }
  if (!res.body) {
    throw new Error("OpenRouter 스트림 본문이 없습니다.");
  }

  const upstream = res.body;
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
              };
              const piece = json.choices?.[0]?.delta?.content;
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {
              // 불완전 JSON 청크는 무시
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
    cancel() {
      void upstream.cancel();
    },
  });
}

export async function generateCommentary(stats: CommentaryStats): Promise<string> {
  return openRouterChat([{ role: "user", content: buildPrompt(stats) }], 300);
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  return openRouterChat(messages, 1200);
}
