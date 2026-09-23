"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Check, Lightbulb, Sparkles, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import type { QuizQuestion } from "@/lib/types";
import { Badge, Button, cx } from "@/components/ui";
import { newId } from "@/lib/id";

const STARTERS = [
  "Çka duhet me mësu sonte?",
  "Sa jam gati për provimin e ardhshëm?",
  "Ma shpjego temën që e kam më të dobët.",
  "Bëma një plan deri të premten.",
];

/** Status lines shown while waiting for the first token. */
const THINKING_LINES = [
  "AI po analizon orarin tënd…",
  "Po kontrolloj provimet dhe afatet…",
  "Po përgatis përgjigjen…",
];

interface Msg {
  id: string;
  role: "user" | "ai";
  text: string;
  quiz?: QuizQuestion[];
  error?: boolean;
}

/**
 * The tutor conversation.
 *
 * Every reply comes from the model over SSE — there is no canned fallback, so
 * what the student reads is always a real answer grounded in their own data.
 * When the service is unavailable the failure is shown plainly instead of
 * being papered over with a scripted response.
 */
export function AIChat({ compact = false }: { compact?: boolean }) {
  const { state } = useStore();
  const [messages, setMessages] = useState<Msg[]>(() =>
    state.aiThread.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      quiz: m.quiz,
    }))
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingLine, setThinkingLine] = useState(0);
  const [streaming, setStreaming] = useState<string | null>(null);

  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Accumulates streamed tokens across awaits without re-rendering per chunk.
  const accRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming]);

  useEffect(() => {
    if (!busy || streaming !== null) return;
    const timer = setInterval(() => setThinkingLine((l) => (l + 1) % THINKING_LINES.length), 2000);
    return () => clearInterval(timer);
  }, [busy, streaming]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInput("");
    setMessages((m) => [...m, { id: newId("u"), role: "user", text: question }]);
    setBusy(true);
    setStreaming(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversationId: conversationId.current }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          {
            id: newId("e"),
            role: "ai",
            text: data.error ?? "AI Asistenti për momentin nuk është i disponueshëm. Provo përsëri.",
            error: true,
          },
        ]);
        return;
      }

      // ── Read the SSE stream ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      accRef.current = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice(7).trim();
          let payload: { text?: string; message?: string; conversationId?: string };
          try {
            payload = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (event === "start" && payload.conversationId) {
            conversationId.current = payload.conversationId;
          } else if (event === "delta" && payload.text) {
            accRef.current += payload.text;
            setStreaming(accRef.current);
          } else if (event === "done") {
            setMessages((m) => [...m, { id: newId("a"), role: "ai", text: accRef.current }]);
            setStreaming(null);
          } else if (event === "error") {
            setMessages((m) => [
              ...m,
              {
                id: newId("e"),
                role: "ai",
                text: payload.message ?? "Diçka shkoi keq.",
                error: true,
              },
            ]);
            setStreaming(null);
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((m) => [
          ...m,
          {
            id: newId("e"),
            role: "ai",
            text: "Lidhja dështoi. Kontrollo internetin dhe provo përsëri.",
            error: true,
          },
        ]);
      }
      setStreaming(null);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const empty = messages.length === 0 && streaming === null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {empty ? (
          <div className={cx("mx-auto max-w-xl", compact ? "pt-4" : "pt-10")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai-soft text-ai">
              <Sparkles size={18} />
            </div>
            <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ink">
              Çka po mësojmë?
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">
              Të njoh orarin, lëndët, detyrat dhe provimet e tua. Pyetmë çfarëdo — ose zgjedh një
              nga këto.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="group flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:border-brand hover:bg-brand-soft"
                >
                  {s}
                  <ArrowUp
                    size={14}
                    className="rotate-45 text-faint transition-colors group-hover:text-brand"
                  />
                </button>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-faint">
              <Lightbulb size={14} className="mt-0.5 shrink-0" />
              Nuk t&apos;i jap përgjigjet e gatshme të detyrave. Të ndihmoj t&apos;i kuptosh vetë —
              me udhëzime, shembuj dhe praktikë.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <Message key={m.id} message={m} onChip={send} />
            ))}

            {streaming !== null && (
              <Message
                message={{ id: "streaming", role: "ai", text: streaming }}
                onChip={send}
                streaming
              />
            )}

            {busy && streaming === null && (
              <div className="anim-fade flex items-center gap-2 pl-10 text-[13px] text-muted">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-ai"
                      style={{ animationDelay: `${i * 160}ms` }}
                    />
                  ))}
                </span>
                {THINKING_LINES[thinkingLine]}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line bg-surface px-4 py-3 sm:px-5">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Pyet Asistentin…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
          />
          {busy ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-10 !px-0"
              aria-label="Ndalo"
              onClick={() => abortRef.current?.abort()}
            >
              <Square size={13} fill="currentColor" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              className="h-10 w-10 !px-0"
              disabled={!input.trim()}
              aria-label="Dërgo"
            >
              <ArrowUp size={16} />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function Message({
  message,
  onChip,
  streaming,
}: {
  message: Msg;
  onChip: (s: string) => void;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="anim-in flex justify-end">
        <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-brand px-3.5 py-2.5 text-[14px] leading-relaxed text-white">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-in flex gap-3">
      <div
        className={cx(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          message.error ? "bg-bad-soft text-bad" : "bg-ai-soft text-ai"
        )}
      >
        {message.error ? <AlertCircle size={14} /> : <Sparkles size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "whitespace-pre-wrap text-[14px] leading-relaxed",
            message.error ? "text-bad" : "text-ink",
            streaming && "caret"
          )}
        >
          {message.text}
        </div>

        {message.quiz && <Quiz questions={message.quiz} />}

        {message.error && (
          <button
            onClick={() => onChip("Provo përsëri")}
            className="mt-2 text-[12.5px] text-brand hover:underline"
          >
            Provo përsëri
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Quiz — used by the chat, subject pages, materials and groups
   ============================================================ */

/**
 * An answerable quiz.
 *
 * When `subjectId` is given the finished attempt is recorded, so the score
 * still exists next week and can feed exam readiness. Without it the quiz is
 * ephemeral — that is the right behaviour for a quiz the assistant improvises
 * mid-conversation, which belongs to no particular subject.
 */
export function Quiz({
  questions,
  subjectId,
  materialId,
}: {
  questions: QuizQuestion[];
  subjectId?: string | null;
  materialId?: string | null;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const savedRef = useRef(false);
  // Stamped on mount, not during render: reading the clock while rendering
  // makes the value depend on when React happens to re-render.
  const startedAt = useRef(0);

  const answered = Object.keys(picked).length;
  const correct = questions.filter((q, i) => picked[i] === q.answer).length;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Recorded once, when the last question is answered. The save is deliberately
  // silent: a student who has just finished should see their score, not a
  // spinner, and a failed write must not take the result away from them.
  useEffect(() => {
    if (savedRef.current || !subjectId || answered < questions.length) return;
    // A ref, not state: this guards a fire-and-forget write and nothing
    // renders from it, so flipping it must not cost a render pass.
    savedRef.current = true;

    void fetch("/api/quiz/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        materialId: materialId ?? null,
        source: materialId ? "material" : "ai",
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
        answers: questions.map((q, i) => ({
          question: q.q,
          options: q.options,
          correctIndex: q.answer,
          chosenIndex: picked[i] ?? -1,
          explanation: q.hint,
          topicName: "",
        })),
      }),
    }).catch(() => {
      // Offline: the score on screen is still correct, just not kept.
    });
  }, [answered, materialId, picked, questions, subjectId]);

  return (
    <div className="mt-3 overflow-hidden rounded-[12px] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <span className="text-[13px] font-medium text-ink">Kuiz · {questions.length} pyetje</span>
        {answered > 0 && (
          <Badge tone={correct === answered ? "ok" : "neutral"}>
            {correct}/{answered} saktë
          </Badge>
        )}
      </div>
      <div className="divide-y divide-line">
        {questions.map((q, i) => {
          const chosen = picked[i];
          return (
            <div key={i} className="px-3.5 py-3">
              <p className="text-[13.5px] font-medium text-ink">
                <span className="num mr-1.5 text-faint">{i + 1}.</span>
                {q.q}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((o, oi) => {
                  const isChosen = chosen === oi;
                  const isRight = oi === q.answer;
                  const reveal = chosen != null;
                  return (
                    <button
                      key={oi}
                      disabled={reveal}
                      onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                      className={cx(
                        "flex items-center justify-between gap-2 rounded-[8px] border px-2.5 py-1.5 text-left text-[13px] transition-colors",
                        !reveal && "border-line hover:border-brand hover:bg-brand-soft",
                        reveal && isRight && "border-ok bg-ok-soft text-ok",
                        reveal && isChosen && !isRight && "border-bad bg-bad-soft text-bad",
                        reveal && !isChosen && !isRight && "border-line text-faint"
                      )}
                    >
                      {o}
                      {reveal && isRight && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
              {chosen != null && chosen !== q.answer && q.hint && (
                <p className="mt-2 text-[12.5px] text-muted">Mendo kështu: {q.hint}</p>
              )}
              {chosen == null && q.hint && (
                <button
                  onClick={() => setHints((h) => ({ ...h, [i]: true }))}
                  className="mt-2 text-[12px] text-ai hover:underline"
                >
                  {hints[i] ? q.hint : "Më jep një udhëzim"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
