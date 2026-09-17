"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Copy,
  LogOut,
  Pause,
  Play,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dur } from "@/lib/date";
import type { QuizQuestion } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Progress,
  SubjectDot,
  Tabs,
  Thinking,
  cx,
  useToast,
} from "@/components/ui";
import { Quiz } from "@/components/app/ai-chat";

interface WireMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  isAI: boolean;
  kind: string;
  quiz?: QuizQuestion[];
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  initials: string;
  tone: number;
  role: string;
  state: "meson" | "pushim" | "offline";
}

const TABS = [
  { key: "chat", label: "Chat" },
  { key: "anetaret", label: "Anëtarët" },
  { key: "shenime", label: "Shënime" },
];

const AI_PROMPTS = [
  "@AI na shpjego këtë temë",
  "@AI na bëj 5 pyetje",
  "@AI përmblidhe diskutimin",
  "@AI krijo plan për këtë sesion",
];

export default function GroupRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, dispatch } = useStore();
  const router = useRouter();
  const toast = useToast();

  const group = state.groups.find((g) => g.id === id);
  if (!group) notFound();

  const subject = state.subjects.find((s) => s.id === group.subjectId);

  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: WireMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (seen.current.has(m.id)) continue;
        seen.current.add(m.id);
        next.push(m);
      }
      return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  // ── Initial history + roster ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [msgRes, memRes] = await Promise.all([
          fetch(`/api/groups/${id}/messages`, { cache: "no-store" }),
          fetch(`/api/groups/${id}/members`, { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (msgRes.ok) {
          const data = await msgRes.json();
          merge(data.messages as WireMessage[]);
        }
        if (memRes.ok) {
          const data = await memRes.json();
          setMembers(data.members as Member[]);
          setInviteCode(data.inviteCode ?? null);
        }
      } catch {
        if (!cancelled) setError("Nuk u lidh me dhomën. Kontrollo internetin.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, merge]);

  // ── Live feed ──
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`/api/groups/${id}/stream?after=${new Date().toISOString()}`);

      source.addEventListener("ready", () => setLive(true));
      source.addEventListener("messages", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        merge(data.messages as WireMessage[]);
        setAiThinking(false);
      });
      source.addEventListener("presence", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setMembers(data.members as Member[]);
      });
      source.addEventListener("bye", () => {
        source?.close();
        connect();
      });
      source.onerror = () => {
        setLive(false);
        source?.close();
        // Reconnect with a short delay rather than hammering the server.
        retry = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [id, merge]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, aiThinking]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;

    setInput("");
    setSending(true);
    setError(null);
    if (/(^|\s)@ai\b/i.test(clean)) setAiThinking(true);

    try {
      const res = await fetch(`/api/groups/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Mesazhi nuk u dërgua.");
        return;
      }
      merge(data.messages as WireMessage[]);
    } catch {
      setError("Lidhja dështoi. Mesazhi nuk u dërgua.");
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  }

  const online = members.filter((m) => m.state !== "offline");

  return (
    <div>
      <Link
        href="/mso-bashke"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Mso Bashkë
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {subject && <SubjectDot toneIndex={subject.tone} />}
            <span className="text-[12.5px] text-muted">{subject?.name ?? "Grup studimi"}</span>
          </div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.025em] text-ink sm:text-[28px]">
            {group.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-muted">
            <span
              className={cx(
                "inline-block h-1.5 w-1.5 rounded-full",
                live ? "thinking-dot bg-ok" : "bg-faint"
              )}
            />
            {online.length} {online.length === 1 ? "anëtar online" : "anëtarë online"}
            <span className="flex items-center gap-1 text-[12px] text-faint">
              {live ? <Wifi size={11} /> : <WifiOff size={11} />}
              {live ? "Lidhur" : "Po rilidhet…"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {inviteCode && (
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(inviteCode);
                toast(`Kodi i ftesës u kopjua: ${inviteCode}`);
              }}
            >
              <Copy size={13} />
              {inviteCode}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const res = await fetch(`/api/groups/${id}/members`, { method: "DELETE" });
              if (res.ok) {
                toast("U largove nga grupi.");
                router.push("/mso-bashke");
                router.refresh();
              }
            }}
          >
            <LogOut size={13} />
            Dil
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <FocusTimer minutes={group.nextSession?.minutes ?? 45} topic={group.nextSession?.topic} />

          <Card padded={false} className="flex min-h-[460px] flex-col">
            <div className="px-4 pt-3">
              <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            {tab === "chat" && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <p className="py-10 text-center text-[13px] text-faint">
                      Ende pa mesazhe. Shkruaj i pari — ose thirr Asistentin me @AI.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((m) => (
                        <Message key={m.id} message={m} />
                      ))}
                      {aiThinking && (
                        <div className="pl-10">
                          <Thinking label="Asistenti po shkruan" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-line p-3">
                  {error && (
                    <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-bad">
                      <AlertCircle size={12} />
                      {error}
                    </p>
                  )}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {AI_PROMPTS.map((s) => (
                      <button
                        key={s}
                        disabled={sending}
                        onClick={() => send(s)}
                        className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-ai hover:text-ai disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(input);
                    }}
                  >
                    <textarea
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send(input);
                        }
                      }}
                      placeholder="Shkruaj në grup… përdor @AI për asistentin"
                      className="max-h-28 min-h-[38px] flex-1 resize-none rounded-[10px] border border-line bg-canvas px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-brand"
                    />
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={sending || !input.trim()}
                      className="h-9 w-9 !px-0"
                      aria-label="Dërgo"
                    >
                      <ArrowUp size={15} />
                    </Button>
                  </form>
                </div>
              </>
            )}

            {tab === "anetaret" && (
              <div className="divide-y divide-line">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar initials={m.initials} toneIndex={m.tone} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {m.name}
                        {m.role === "owner" && (
                          <span className="ml-1.5 text-[11px] text-faint">host</span>
                        )}
                      </span>
                      <span
                        className={cx(
                          "block text-[12px]",
                          m.state === "meson"
                            ? "text-ok"
                            : m.state === "pushim"
                              ? "text-warn"
                              : "text-faint"
                        )}
                      >
                        {m.state === "meson"
                          ? "Duke mësuar"
                          : m.state === "pushim"
                            ? "Pushim"
                            : "Offline"}
                      </span>
                    </span>
                    {m.id === "me" && (
                      <button
                        onClick={() =>
                          dispatch({
                            type: "group/memberState",
                            groupId: id,
                            memberId: "me",
                            state: m.state === "meson" ? "pushim" : "meson",
                          })
                        }
                        className="text-[11.5px] text-brand hover:underline"
                      >
                        {m.state === "meson" ? "Shëno pushim" : "Vazhdo"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "shenime" && (
              <div className="flex flex-1 flex-col p-4">
                <p className="mb-2 text-[12.5px] text-muted">
                  Shënime të përbashkëta — çdo anëtar mund t&apos;i redaktojë.
                </p>
                <textarea
                  defaultValue={group.sharedNotes}
                  onBlur={(e) =>
                    dispatch({ type: "group/notes", groupId: id, notes: e.target.value })
                  }
                  placeholder="Shkruani bashkë këtu…"
                  className="min-h-[280px] flex-1 resize-none rounded-[10px] border border-line bg-canvas p-3.5 text-[13.5px] leading-relaxed text-ink outline-none focus:border-brand"
                />
              </div>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center gap-2 text-ai">
              <Sparkles size={14} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
                Asistenti në grup
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Thirre me <span className="font-medium text-ink">@AI</span> në chat. Përgjigjet e tij
              i sheh i gjithë grupi.
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
              Asistenti nuk ua jep përgjigjet e detyrave — ju drejton me pyetje që ju çojnë te
              zgjidhja.
            </p>
          </Card>

          <Card padded={false}>
            <div className="px-5 pb-2 pt-4">
              <p className="text-[13px] font-medium text-ink">Online tani</p>
            </div>
            <div className="divide-y divide-line">
              {online.length === 0 && (
                <p className="px-5 pb-4 text-[12.5px] text-faint">Askush nuk është online.</p>
              )}
              {online.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar initials={m.initials} toneIndex={m.tone} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{m.name}</span>
                  <span
                    className={cx(
                      "h-1.5 w-1.5 rounded-full",
                      m.state === "meson" ? "bg-ok" : "bg-warn"
                    )}
                  />
                </div>
              ))}
            </div>
          </Card>

          {inviteCode && (
            <Card>
              <p className="text-[13px] font-medium text-ink">Fto shokët</p>
              <p className="mt-1.5 text-[12.5px] text-muted">
                Ndaje këtë kod — ata e futin te Mso Bashkë → Bashkohu.
              </p>
              <p className="num mt-3 rounded-[9px] border border-dashed border-line bg-canvas px-3 py-2 text-center text-[17px] font-semibold tracking-[0.15em] text-ink">
                {inviteCode}
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Focus timer
   ============================================================ */

function FocusTimer({ minutes, topic }: { minutes: number; topic?: string }) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const mm = Math.floor(left / 60);
  const ss = left % 60;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Tema aktuale</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {topic ?? "Sesion i lirë"}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">Sesion {dur(minutes)}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="num text-[34px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
            {`${mm}`.padStart(2, "0")}:{`${ss}`.padStart(2, "0")}
          </div>
          <Button variant={running ? "secondary" : "primary"} onClick={() => setRunning((r) => !r)}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? "Ndal" : "Fillo"}
          </Button>
        </div>
      </div>
      <Progress value={((total - left) / total) * 100} className="mt-4" height={4} />
    </Card>
  );
}

/* ============================================================
   Message
   ============================================================ */

function Message({ message }: { message: WireMessage }) {
  if (message.kind === "system" && !message.isAI) {
    return (
      <p className="anim-fade text-center text-[12px] text-faint">{message.text}</p>
    );
  }

  if (message.isAI) {
    return (
      <div className="anim-in flex gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai">
          <Sparkles size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-ai">{message.authorName}</span>
            {message.kind === "plan" && <Badge tone="ai">Moderator</Badge>}
            <span className="num text-[11.5px] text-faint">{message.at}</span>
          </div>
          <div
            className={cx(
              "mt-1 whitespace-pre-wrap rounded-[10px] px-3 py-2.5 text-[13.5px] leading-relaxed",
              message.kind === "system"
                ? "border border-bad/30 bg-bad-soft text-bad"
                : message.kind === "plan"
                  ? "border border-ai/25 bg-ai-soft/45 text-ink"
                  : "bg-sunken/70 text-ink"
            )}
          >
            {message.text}
          </div>
          {message.quiz && <Quiz questions={message.quiz} />}
        </div>
      </div>
    );
  }

  const mine = message.authorId === "me";

  return (
    <div className={cx("anim-in flex gap-3", mine && "flex-row-reverse")}>
      <Avatar
        initials={message.authorName.slice(0, 2).toUpperCase()}
        toneIndex={mine ? 0 : message.authorName.length % 5}
        size={28}
      />
      <div className={cx("min-w-0 max-w-[80%]", mine && "text-right")}>
        <div className={cx("flex items-baseline gap-2", mine && "flex-row-reverse")}>
          <span className="text-[13px] font-semibold text-ink">
            {mine ? "Ti" : message.authorName}
          </span>
          <span className="num text-[11.5px] text-faint">{message.at}</span>
        </div>
        <div
          className={cx(
            "mt-1 inline-block whitespace-pre-wrap rounded-[10px] px-3 py-2 text-left text-[13.5px] leading-relaxed",
            mine ? "bg-brand text-white" : "bg-sunken/70 text-ink"
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
