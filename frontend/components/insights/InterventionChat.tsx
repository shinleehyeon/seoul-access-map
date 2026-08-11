"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { MarkdownMessage } from "@/components/insights/MarkdownMessage";

type Role = "user" | "assistant";

type ChatTurn = {
  role: Role;
  content: string;
};

const STORAGE_KEY = "intervention-chat-session";
const EMPTY: ChatTurn[] = [];
const SUGGESTIONS = [
  "대형차 사망 비중을 줄이려면?",
  "고령 자전거 사고, 어디부터 손볼까?",
  "교차로 치사율을 낮추는 개입",
  "전용도로 밖 사고를 줄이려면?",
  "새벽 시간대 안전 대책은?",
];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedMessages: ChatTurn[] = EMPTY;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function parseMessages(raw: string | null): ChatTurn[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const messages = parsed.filter(
      (m): m is ChatTurn =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
    return messages.length ? messages : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readMessages(): ChatTurn[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedMessages;
  cachedRaw = raw;
  cachedMessages = parseMessages(raw);
  return cachedMessages;
}

function writeMessages(next: ChatTurn[]) {
  const raw = next.length ? JSON.stringify(next) : null;
  if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedMessages = next.length ? next : EMPTY;
  emit();
}

export function InterventionChat() {
  const messages = useSyncExternalStore(subscribe, readMessages, () => EMPTY);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);

  messagesRef.current = messages;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const clearSession = useCallback(() => {
    writeMessages([]);
    setError(null);
    setInput("");
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatTurn[] = [
      ...messagesRef.current,
      { role: "user", content: trimmed },
    ];
    writeMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "응답을 받지 못했습니다.");
      }
      if (!res.body) {
        throw new Error("스트림 본문이 없습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        writeMessages([...nextMessages, { role: "assistant", content: reply }]);
      }

      if (!reply.trim()) {
        throw new Error("응답을 받지 못했습니다.");
      }
    } catch (err) {
      const current = messagesRef.current;
      const last = current[current.length - 1];
      if (last?.role === "assistant" && !last.content.trim()) {
        writeMessages(current.slice(0, -1));
      }
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          hasMessages ? "justify-between" : "items-center justify-center"
        }`}
      >
        {hasMessages ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearSession}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              >
                새 대화
              </button>
            </div>
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    m.role === "user"
                      ? "bg-[#18181b] text-sm leading-relaxed whitespace-pre-wrap text-white"
                      : "border border-[#e5e5e5] bg-white text-[#18181b]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <MarkdownMessage content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== "assistant" ? (
              <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                답변 작성 중…
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div ref={bottomRef} />
          </div>
        ) : null}

        <div className={`w-full ${hasMessages ? "" : "max-w-2xl"}`}>
          {!hasMessages ? (
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-[#18181b]">
                자전거 안전, 무엇이든 물어보세요
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                서울 사고 패턴을 바탕으로 개입 방향을 함께 정리합니다.
              </p>
            </div>
          ) : null}

          <div
            className={`mb-3 flex flex-wrap gap-2 ${hasMessages ? "justify-start" : "justify-center"}`}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={loading}
                className="rounded-full border border-[#e5e5e5] bg-white px-3.5 py-1.5 text-sm text-[#18181b] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="무엇이든 물어보세요..."
              rows={2}
              disabled={loading}
              className="max-h-40 min-h-[72px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm outline-none placeholder:text-[#a1a1aa] disabled:opacity-60"
            />
            <div className="flex items-center justify-end px-3 pb-3">
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={loading || !input.trim()}
                aria-label="전송"
                className="inline-flex size-9 items-center justify-center rounded-full bg-[#18181b] text-white transition-opacity disabled:opacity-30"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>

          {!hasMessages && error ? (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
