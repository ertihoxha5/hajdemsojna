"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import {
  Check,
  FileText,
  Layers,
  Pause,
  Play,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dur } from "@/lib/date";
import { SESSION_LABEL } from "@/lib/planner";
import { buildPomodoro, phaseLabel } from "@/lib/pomodoro";
import {
  Button,
  Card,
  IconButton,
  Tabs,
  Thinking,
  ToastHost,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import { ReviewModal } from "@/components/app/session-row";
import { Quiz } from "@/components/app/ai-chat";
import { useAIAsk, useAIQuiz } from "@/components/app/use-ai";

export default function StudyModePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ToastHost>
      <StudyMode params={params} />
    </ToastHost>
  );
}

function StudyMode({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useStore();
  const router = useRouter();

  const session = state.sessions.find((s) => s.id === id);
  const subject = state.subjects.find((s) => s.id === session?.subjectId);
  const c = useTone(subject?.tone ?? 0);

  // The session is split into work and break blocks using the rhythm the
  // student set in Cilësimet, rather than run as one undifferentiated hour.
  const plan = useMemo(
    () =>
      buildPomodoro(
        session?.minutes ?? 45,
        state.availability.sessionLength,
        state.availability.breakLength
      ),
    [session?.minutes, state.availability.sessionLength, state.availability.breakLength]
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = plan.phases[phaseIndex] ?? plan.phases[0];

  const total = phase.seconds;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);
  const [panel, setPanel] = useState<string | null>(null);
  const [review, setReview] = useState(false);

  // A new phase resets the clock to that phase's length.
  useEffect(() => {
    setLeft(plan.phases[phaseIndex]?.seconds ?? 0);
  }, [phaseIndex, plan]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((v) => {
        if (v > 1) return v - 1;

        // This phase is over. Move to the next one, or finish the session and
        // ask how it went if this was the last.
        if (phaseIndex < plan.phases.length - 1) {
          setPhaseIndex((i) => i + 1);
        } else {
          setRunning(false);
          setReview(true);
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phaseIndex, plan.phases.length]);

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
        <p className="text-[15px] text-muted">Ky sesion nuk ekziston më.</p>
        <Button variant="primary" onClick={() => router.push("/sot")}>
          Kthehu te Sot
        </Button>
      </div>
    );
  }

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const progress = total > 0 ? ((total - left) / total) * 100 : 0;
  const onBreak = phase.kind === "pushim";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* top bar */}
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full" style={{ background: c.fg }} />
          <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted">
            {subject?.name ?? "Sesion"}
          </span>
          <span className="text-[12.5px] text-faint">{SESSION_LABEL[session.kind]}</span>
        </div>
        <IconButton label="Mbyll" onClick={() => router.push("/sot")}>
          <X size={17} />
        </IconButton>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── Focus area ──────────────────────────────── */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-lg text-center">
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">
              {session.title}
            </h1>

            {plan.phases.length > 1 && (
              <p
                className={cx(
                  "mt-5 text-[12px] font-semibold uppercase tracking-[0.08em]",
                  onBreak ? "text-ok" : "text-muted"
                )}
              >
                {phaseLabel(phase, plan.rounds)}
              </p>
            )}

            <div
              className={cx(
                "num mt-8 text-[76px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[96px]",
                !running ? "text-muted" : onBreak ? "text-ok" : "text-ink"
              )}
            >
              {`${mm}`.padStart(2, "0")}:{`${ss}`.padStart(2, "0")}
            </div>

            <div className="mx-auto mt-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%`, background: c.fg }}
              />
            </div>
            <p className="num mt-2.5 text-[12.5px] text-faint">
              {dur(session.minutes)} gjithsej · {Math.round(progress)}% e kësaj faze
            </p>

            {onBreak && (
              <p className="mx-auto mt-4 max-w-xs text-[13px] leading-relaxed text-muted">
                Largohu nga ekrani. Pushimi është pjesë e mësimit, jo ndërprerje
                e tij.
              </p>
            )}

            {session.objective && (
              <div className="mx-auto mt-8 max-w-md rounded-[12px] border border-line bg-surface px-4 py-3.5">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                  Objektivi i sesionit
                </p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">{session.objective}</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Button size="lg" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause size={16} /> : <Play size={16} />}
                {running ? "Pauzë" : "Vazhdo"}
              </Button>
              <Button size="lg" variant="primary" onClick={() => setReview(true)}>
                <Check size={16} />
                Përfundo
              </Button>
              <Button
                size="lg"
                variant="ai"
                onClick={() => setPanel(panel === "ai" ? null : "ai")}
              >
                <Sparkles size={16} />
                Pyet AI
              </Button>
            </div>
          </div>
        </main>

        {/* ── Side panel ──────────────────────────────── */}
        <aside
          className={cx(
            "border-line bg-surface transition-all lg:w-[360px] lg:border-l",
            panel ? "border-t" : "border-t lg:w-[64px]"
          )}
        >
          {panel ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 px-4 pt-3">
                <Tabs
                  tabs={[
                    { key: "shenime", label: "Shënime" },
                    { key: "flashcards", label: "Flashcards" },
                    { key: "ai", label: "AI" },
                    { key: "burime", label: "Burime" },
                  ]}
                  active={panel}
                  onChange={setPanel}
                />
                <IconButton label="Mbyll panelin" onClick={() => setPanel(null)}>
                  <X size={15} />
                </IconButton>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {panel === "shenime" && <NotesPanel sessionId={session.id} />}
                {panel === "flashcards" && <FlashcardsPanel subjectId={session.subjectId} />}
                {panel === "ai" && <AskPanel title={session.title} subjectId={session.subjectId} />}
                {panel === "burime" && <ResourcesPanel subjectId={session.subjectId} />}
              </div>
            </div>
          ) : (
            <div className="flex flex-row justify-center gap-2 p-3 lg:flex-col lg:items-center">
              {[
                { key: "shenime", icon: StickyNote, label: "Shënime" },
                { key: "flashcards", icon: Layers, label: "Flashcards" },
                { key: "ai", icon: Sparkles, label: "AI" },
                { key: "burime", icon: FileText, label: "Burime" },
              ].map((p) => (
                <IconButton key={p.key} label={p.label} onClick={() => setPanel(p.key)}>
                  <p.icon size={17} />
                </IconButton>
              ))}
            </div>
          )}
        </aside>
      </div>

      <ReviewModal
        open={review}
        onClose={() => setReview(false)}
        sessionId={session.id}
        onDone={() => router.push("/sot")}
      />
    </div>
  );
}

function NotesPanel({ sessionId }: { sessionId: string }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const session = state.sessions.find((s) => s.id === sessionId)!;
  const [text, setText] = useState("");

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[12.5px] text-muted">
        Shkruaj çfarë të mbetet nga ky sesion — ruhet te lënda.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Çelësi i kësaj teme është…"
        className="min-h-[220px] flex-1 resize-none rounded-[10px] border border-line bg-canvas p-3.5 text-[13.5px] leading-relaxed text-ink outline-none focus:border-brand"
      />
      <Button
        variant="primary"
        className="mt-2"
        onClick={() => {
          if (!text.trim()) return;
          dispatch({
            type: "note/save",
            note: {
              id: `nt-${Date.now().toString(36)}`,
              subjectId: session.subjectId,
              title: session.title,
              body: text.trim(),
              updatedAt: today,
            },
          });
          setText("");
          toast("Shënimi u ruajt te lënda.");
        }}
      >
        Ruaj shënimin
      </Button>
    </div>
  );
}

function FlashcardsPanel({ subjectId }: { subjectId: string | null }) {
  const quiz = useAIQuiz();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = (quiz.questions ?? []).map((q) => ({
    front: q.q,
    back: q.options[q.answer],
    hint: q.hint,
  }));

  if (!subjectId) {
    return <p className="text-[13px] text-muted">Ky sesion nuk është i lidhur me një lëndë.</p>;
  }

  if (!cards.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Layers size={20} className="mb-3 text-faint" />
        <p className="text-[14px] font-medium text-ink">Flashcards nga AI</p>
        <p className="mt-1 max-w-xs text-[13px] text-muted">
          Gjenerohen nga temat e kësaj lënde që ende nuk i ke zotëruar.
        </p>
        {quiz.error && <p className="mt-3 text-[12.5px] text-bad">{quiz.error}</p>}
        <Button
          variant="ai"
          className="mt-4"
          disabled={quiz.busy}
          onClick={() => quiz.generate({ subjectId, count: 5 })}
        >
          {quiz.busy ? "Po krijoj…" : "Krijo flashcards"}
        </Button>
      </div>
    );
  }

  const card = cards[i % cards.length];

  return (
    <div>
      <p className="num mb-3 text-[12px] text-faint">
        {(i % cards.length) + 1} / {cards.length}
      </p>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-[12px] border border-line bg-canvas px-5 py-6 text-center transition-colors hover:border-brand"
      >
        <p className="text-[14.5px] leading-relaxed text-ink">
          {flipped ? card.back : card.front}
        </p>
        <p className="mt-3 text-[11.5px] text-faint">
          {flipped ? "Kliko për pyetjen" : "Kliko për përgjigjen"}
        </p>
      </button>
      {card.hint && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Udhëzim: {card.hint}</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            setFlipped(false);
            setI((v) => (v - 1 + cards.length) % cards.length);
          }}
        >
          Para
        </Button>
        <Button
          className="flex-1"
          variant="primary"
          onClick={() => {
            setFlipped(false);
            setI((v) => (v + 1) % cards.length);
          }}
        >
          Tjetra
        </Button>
      </div>
    </div>
  );
}

function AskPanel({ title, subjectId }: { title: string; subjectId: string | null }) {
  const [q, setQ] = useState("");
  const { ask, answer, error, busy } = useAIAsk();
  const quiz = useAIQuiz();

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[`Ma shpjego ${title}`, "Jepmë një shembull", "Ku ngec zakonisht studentët këtu?"].map(
          (s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => ask(s)}
              className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-ai hover:text-ai disabled:opacity-50"
            >
              {s}
            </button>
          )
        )}
        {subjectId && (
          <button
            disabled={quiz.busy}
            onClick={() => quiz.generate({ subjectId, count: 4 })}
            className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-ai hover:text-ai disabled:opacity-50"
          >
            {quiz.busy ? "Po krijoj…" : "Testom shkurt"}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) {
            ask(q.trim());
            setQ("");
          }
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pyet pa e ndërprerë sesionin…"
          className="flex-1 rounded-[9px] border border-line bg-canvas px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand"
        />
        <Button variant="primary" type="submit" disabled={busy || !q.trim()}>
          Pyet
        </Button>
      </form>

      {busy && answer === "" && (
        <div className="mt-4">
          <Thinking label="AI po mendon…" />
        </div>
      )}

      {error && (
        <Card className="anim-in mt-4 border-bad/30 bg-bad-soft">
          <p className="text-[13px] text-bad">{error}</p>
        </Card>
      )}

      {answer && (
        <Card className="anim-in mt-4 border-ai/25 bg-ai-soft/30">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{answer}</p>
        </Card>
      )}

      {quiz.error && (
        <Card className="anim-in mt-4 border-bad/30 bg-bad-soft">
          <p className="text-[13px] text-bad">{quiz.error}</p>
        </Card>
      )}

      {quiz.questions && <Quiz questions={quiz.questions} subjectId={subjectId} />}
    </div>
  );
}

function ResourcesPanel({ subjectId }: { subjectId: string | null }) {
  const { state } = useStore();
  const materials = state.materials.filter((m) => m.subjectId === subjectId);
  const notes = state.notes.filter((n) => n.subjectId === subjectId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">
          Materiale
        </p>
        <div className="flex flex-col gap-1.5">
          {materials.length === 0 && (
            <p className="text-[13px] text-muted">Pa materiale për këtë lëndë.</p>
          )}
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 rounded-[9px] border border-line px-3 py-2"
            >
              <FileText size={14} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{m.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">
          Shënimet e tua
        </p>
        <div className="flex flex-col gap-2">
          {notes.length === 0 && <p className="text-[13px] text-muted">Pa shënime ende.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-[9px] border border-line px-3 py-2.5">
              <p className="text-[13px] font-medium text-ink">{n.title}</p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
                {n.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
