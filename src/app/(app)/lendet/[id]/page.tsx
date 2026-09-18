"use client";

import Link from "next/link";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  Presentation,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dayMonth, dur, relativeDays, shortDate } from "@/lib/date";
import {
  currentGrade,
  examReadiness,
  minutesStudied,
  neededOnRemaining,
  nextExamFor,
  priorityFor,
  subjectProgress,
  topicsDone,
} from "@/lib/planner";
import { newId } from "@/lib/id";
import type { Mastery, Topic } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Progress,
  Ring,
  Stat,
  SubjectDot,
  Tabs,
  Thinking,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import { Quiz } from "@/components/app/ai-chat";
import { useAIAsk, useAIQuiz } from "@/components/app/use-ai";

const MASTERY: { value: Mastery; label: string; tone: string }[] = [
  { value: 0, label: "Nuk e di", tone: "text-faint" },
  { value: 1, label: "Pak", tone: "text-warn" },
  { value: 2, label: "E kuptoj", tone: "text-brand" },
  { value: 3, label: "E zotëroj", tone: "text-ok" },
];

const TABS = [
  { key: "permbledhje", label: "Përmbledhje" },
  { key: "tema", label: "Tema" },
  { key: "detyra", label: "Detyra" },
  { key: "provime", label: "Provime" },
  { key: "shenime", label: "Shënime" },
  { key: "materiale", label: "Materiale" },
  { key: "nota", label: "Nota" },
  { key: "ai", label: "AI" },
];

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, today } = useStore();
  const [tab, setTab] = useState("permbledhje");

  const subject = state.subjects.find((s) => s.id === id);
  if (!subject) notFound();

  const c = useTone(subject.tone);
  const progress = subjectProgress(subject);
  const grade = currentGrade(state, subject.id);
  const exam = nextExamFor(state, subject.id, today);

  return (
    <div>
      <Link
        href="/lendet"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Lëndët
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <SubjectDot toneIndex={subject.tone} size={10} />
            {subject.name}
          </span>
        }
        question={`${subject.teacher} · ${subject.room} · ${subject.credits} ECTS`}
        right={
          <Link href="/plani">
            <Button variant="primary" size="md">
              <Sparkles size={14} />
              Planifiko mësim
            </Button>
          </Link>
        }
      />

      {/* ── Summary strip ─────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <Ring value={progress} size={58} stroke={6} color={c.fg}>
            <span className="num text-[14px] font-semibold text-ink">{progress}%</span>
          </Ring>
          <div>
            <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Progresi</p>
            <p className="num mt-1 text-[13px] text-muted">
              {topicsDone(subject)} / {subject.topics.length} tema
            </p>
          </div>
        </Card>
        <Card>
          <Stat label="Nota aktuale" value={grade.toFixed(1)} sub={`Objektivi ${subject.targetGrade}`} />
        </Card>
        <Card>
          <Stat
            label="Provimi i ardhshëm"
            value={exam ? dayMonth(exam.date) : "—"}
            sub={exam ? `${relativeDays(today, exam.date)} · gatishmëria ${examReadiness(state, exam)}%` : "Pa provim të planifikuar"}
          />
        </Card>
        <Card>
          <Stat
            label="Kohë mësimi"
            value={dur(minutesStudied(state, subject.id))}
            sub={`Vështirësia ${subject.difficulty}/5`}
          />
        </Card>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

      {tab === "permbledhje" && <Overview subjectId={subject.id} />}
      {tab === "tema" && <TopicsTab subjectId={subject.id} />}
      {tab === "detyra" && <AssignmentsTab subjectId={subject.id} />}
      {tab === "provime" && <ExamsTab subjectId={subject.id} />}
      {tab === "shenime" && <NotesTab subjectId={subject.id} />}
      {tab === "materiale" && <MaterialsTab subjectId={subject.id} />}
      {tab === "nota" && <GradesTab subjectId={subject.id} />}
      {tab === "ai" && <AITab subjectId={subject.id} />}
    </div>
  );
}

/* ============================================================
   Tabs
   ============================================================ */

function Overview({ subjectId }: { subjectId: string }) {
  const { state, today } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const priority = priorityFor(state, subject, today);
  const need = neededOnRemaining(state, subject);
  const sessions = state.sessions
    .filter((s) => s.subjectId === subjectId && s.status === "done")
    .slice(-5)
    .reverse();
  const weak = subject.topics.filter((t) => t.mastery <= 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card className="border-ai/25 bg-ai-soft/30">
          <div className="flex items-center gap-2 text-ai">
            <Sparkles size={14} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
              Ku qëndron
            </span>
          </div>
          <p className="mt-2.5 text-[14px] leading-relaxed text-ink">{priority.reason}</p>
          {need && !need.secured && need.reachable && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Për një notë finale {subject.targetGrade}, të duhet rreth{" "}
              <span className="num font-semibold text-ink">{need.need}</span> në {need.remainingWeight}%
              e mbetur të vlerësimit.
            </p>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pb-3 pt-4">
            <p className="text-[13px] font-medium text-ink">Temat që kërkojnë punë</p>
          </div>
          {weak.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-muted">
              Të gjitha temat janë të paktën në nivelin “e kuptoj”.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {weak.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <MasteryPip mastery={t.mastery} />
                  <span className="flex-1 truncate text-[13.5px] text-ink">{t.name}</span>
                  <span className="num text-[12px] text-faint">{dur(t.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padded={false} className="h-fit">
        <div className="px-5 pb-3 pt-4">
          <p className="text-[13px] font-medium text-ink">Sesionet e fundit</p>
        </div>
        <div className="divide-y divide-line">
          {sessions.length === 0 && (
            <p className="px-5 pb-5 text-[13px] text-muted">Ende pa sesione të përfunduara.</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] text-ink">{s.title}</span>
                <span className="num shrink-0 text-[11.5px] text-faint">{shortDate(s.date)}</span>
              </div>
              <div className="num mt-1 flex items-center gap-2 text-[11.5px] text-muted">
                {dur(s.minutes)}
                {s.understanding && <span>· kuptueshmëria {s.understanding}/5</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MasteryPip({ mastery }: { mastery: Mastery }) {
  const color =
    mastery === 3 ? "var(--ok)" : mastery === 2 ? "var(--brand)" : mastery === 1 ? "var(--warn)" : "var(--line)";
  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <span
        className="h-3.5 w-3.5 rounded-full border-2"
        style={{
          borderColor: color,
          background:
            mastery === 3 ? color : mastery === 2 ? `color-mix(in srgb, ${color} 45%, transparent)` : "transparent",
        }}
      />
    </span>
  );
}

function TopicsTab({ subjectId }: { subjectId: string }) {
  const { state, dispatch } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const [adding, setAdding] = useState("");
  const toast = useToast();

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="text-[13px] font-medium text-ink">
          {topicsDone(subject)} / {subject.topics.length} tema të zotëruara
        </p>
        <span className="text-[12px] text-faint">Shëno nivelin për secilën temë</span>
      </div>

      <div className="divide-y divide-line">
        {subject.topics.map((t: Topic) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken/50"
          >
            <MasteryPip mastery={t.mastery} />
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.name}</span>
            <span className="num hidden text-[12px] text-faint sm:block">{dur(t.minutes)}</span>
            <div className="flex gap-1">
              {MASTERY.map((m) => (
                <button
                  key={m.value}
                  onClick={() =>
                    dispatch({
                      type: "topic/mastery",
                      subjectId,
                      topicId: t.id,
                      mastery: m.value,
                    })
                  }
                  className={cx(
                    "rounded-[7px] border px-2 py-1 text-[11.5px] font-medium transition-colors",
                    t.mastery === m.value
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-muted hover:bg-sunken"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-line p-3">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Shto një temë të re…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && adding.trim()) {
              dispatch({
                type: "topic/add",
                subjectId,
                topicId: newId("t"),
                name: adding.trim(),
              });
              setAdding("");
              toast("Tema u shtua.");
            }
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            if (!adding.trim()) return;
            dispatch({
              type: "topic/add",
              subjectId,
              topicId: newId("t"),
              name: adding.trim(),
            });
            setAdding("");
            toast("Tema u shtua.");
          }}
        >
          <Plus size={14} />
          Shto
        </Button>
      </div>
    </Card>
  );
}

function AssignmentsTab({ subjectId }: { subjectId: string }) {
  const { state, dispatch, today } = useStore();
  const items = state.assignments.filter((a) => a.subjectId === subjectId);

  if (!items.length)
    return <EmptyState title="Pa detyra" body="Kjo lëndë nuk ka detyra të regjistruara." />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((a) => (
        <Card key={a.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cx("text-[15px] font-medium text-ink", a.done && "line-through")}>
                {a.title}
              </p>
              <p className="mt-1 text-[13px] text-muted">{a.detail}</p>
            </div>
            <Badge tone={a.done ? "ok" : relativeDays(today, a.due).includes("vonesë") ? "bad" : "warn"}>
              {a.done ? "Dorëzuar" : relativeDays(today, a.due)}
            </Badge>
          </div>
          <Progress value={a.progress} className="mt-3.5" />
          <div className="mt-3 flex flex-col gap-1.5">
            {a.steps.map((s) => (
              <button
                key={s.id}
                onClick={() => dispatch({ type: "assignment/step", id: a.id, stepId: s.id })}
                className="flex items-center gap-2.5 text-left text-[13px]"
              >
                <span
                  className={cx(
                    "flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors",
                    s.done ? "border-ok bg-ok text-white" : "border-line"
                  )}
                >
                  {s.done && <Check size={11} />}
                </span>
                <span className={cx(s.done ? "text-faint line-through" : "text-ink")}>{s.label}</span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExamsTab({ subjectId }: { subjectId: string }) {
  const { state, today } = useStore();
  const items = state.exams.filter((e) => e.subjectId === subjectId);

  if (!items.length) return <EmptyState title="Pa provime" body="Ende pa provime të caktuara." />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((e) => {
        const r = examReadiness(state, e);
        return (
          <Card key={e.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium text-ink">{e.title}</p>
                <p className="num mt-1 text-[13px] text-muted">
                  {dayMonth(e.date)} · {e.start} · {e.room}
                </p>
              </div>
              <Ring value={r} size={52} stroke={5} color={r < 60 ? "var(--warn)" : "var(--ok)"}>
                <span className="num text-[12.5px] font-semibold text-ink">{r}%</span>
              </Ring>
            </div>
            <p className="mt-3 text-[12.5px] text-faint">
              {relativeDays(today, e.date)} · {dur(e.studiedMinutes)} mësim
            </p>
          </Card>
        );
      })}
    </div>
  );
}

function NotesTab({ subjectId }: { subjectId: string }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const notes = state.notes.filter((n) => n.subjectId === subjectId);
  const [draft, setDraft] = useState({ title: "", body: "" });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        {notes.length === 0 && (
          <EmptyState title="Pa shënime" body="Shkruaj shënimin e parë për këtë lëndë." />
        )}
        {notes.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-medium text-ink">{n.title}</p>
              <span className="num shrink-0 text-[11.5px] text-faint">{shortDate(n.updatedAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">
              {n.body}
            </p>
          </Card>
        ))}
      </div>

      <Card className="h-fit">
        <p className="text-[13px] font-medium text-ink">Shënim i ri</p>
        <Input
          className="mt-3"
          placeholder="Titulli"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          rows={6}
          placeholder="Shkruaj këtu…"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          className="mt-2 w-full resize-y rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand"
        />
        <Button
          variant="primary"
          className="mt-2 w-full"
          onClick={() => {
            if (!draft.title.trim() && !draft.body.trim()) return;
            dispatch({
              type: "note/save",
              note: {
                id: `nt-${Date.now().toString(36)}`,
                subjectId,
                title: draft.title.trim() || "Shënim pa titull",
                body: draft.body.trim(),
                updatedAt: today,
              },
            });
            setDraft({ title: "", body: "" });
            toast("Shënimi u ruajt.");
          }}
        >
          Ruaj shënimin
        </Button>
      </Card>
    </div>
  );
}

const MATERIAL_ICON = {
  pdf: FileText,
  ppt: Presentation,
  link: Link2,
  foto: ImageIcon,
  dok: StickyNote,
} as const;

function MaterialsTab({ subjectId }: { subjectId: string }) {
  const { state } = useStore();
  const items = state.materials.filter((m) => m.subjectId === subjectId);

  if (!items.length)
    return (
      <EmptyState
        title="Pa materiale"
        body="Shto sllajde, PDF ose lidhje te faqja Materialet."
        action={
          <Link href="/materialet">
            <Button variant="primary" size="sm">
              Hap Materialet
            </Button>
          </Link>
        }
      />
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => {
        const Icon = MATERIAL_ICON[m.kind];
        return (
          <Card key={m.id} hover>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-sunken text-muted">
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{m.title}</p>
                <p className="mt-0.5 text-[12px] text-faint">{m.meta}</p>
                {m.summary && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{m.summary}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function GradesTab({ subjectId }: { subjectId: string }) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const grades = state.grades.filter((g) => g.subjectId === subjectId);
  const need = neededOnRemaining(state, subject);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card padded={false}>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">
          <span>Vlerësimi</span>
          <span>Pesha</span>
          <span>Nota</span>
        </div>
        <div className="divide-y divide-line">
          {grades.map((g) => (
            <div key={g.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] text-ink">{g.title}</p>
                <p className="num text-[11.5px] text-faint">{shortDate(g.date)}</p>
              </div>
              <span className="num text-[12.5px] text-muted">{Math.round(g.weight * 100)}%</span>
              <span className="num w-8 text-right text-[15px] font-semibold text-ink">{g.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="h-fit">
        <Stat
          label="Nota aktuale"
          value={currentGrade(state, subjectId).toFixed(1)}
          sub={`Objektivi ${subject.targetGrade}`}
        />
        <div className="mt-4 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-ai">
            <Sparkles size={12} />
            Vëzhgim
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {need == null
              ? "Të gjitha vlerësimet janë mbyllur."
              : need.secured
                ? "Objektivi është siguruar."
                : need.reachable
                  ? `Për notën ${subject.targetGrade} të duhet rreth ${need.need} në ${need.remainingWeight}% e mbetur.`
                  : `Objektivi ${subject.targetGrade} nuk arrihet më. Synim realist: ${Math.floor((currentGrade(state, subjectId) + 10) / 2)}.`}
          </p>
        </div>
      </Card>
    </div>
  );
}

function AITab({ subjectId }: { subjectId: string }) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const { ask, answer, error, busy } = useAIAsk();
  const quiz = useAIQuiz();

  const actions = [
    `Sa jam gati për provimin e ${subject.name}?`,
    `Cilat tema duhet t'i përsëris te ${subject.name}?`,
    `Ma shpjego temën më të vështirë të ${subject.name}.`,
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-3">
        <Card className="border-ai/25 bg-ai-soft/30">
          <div className="flex items-center gap-2 text-ai">
            <Sparkles size={14} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
              Asistenti për {subject.name}
            </span>
          </div>
          <p className="mt-2 text-[13.5px] text-muted">
            Asistenti njeh temat, notat dhe provimet e kësaj lënde. Zgjedh një veprim ose hap
            bisedën e plotë.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a} size="sm" disabled={busy} onClick={() => ask(a)}>
                {a}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ai"
              disabled={quiz.busy}
              onClick={() => quiz.generate({ subjectId, count: 5 })}
            >
              {quiz.busy ? "Po krijoj kuizin…" : "Krijo kuiz"}
            </Button>
          </div>
        </Card>

        {busy && answer === "" && (
          <Card className="anim-in">
            <Thinking label="AI po analizon këtë lëndë…" />
          </Card>
        )}

        {error && (
          <Card className="anim-in border-bad/30 bg-bad-soft">
            <p className="text-[13.5px] text-bad">{error}</p>
          </Card>
        )}

        {answer && (
          <Card className="anim-in">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{answer}</p>
          </Card>
        )}

        {quiz.error && (
          <Card className="anim-in border-bad/30 bg-bad-soft">
            <p className="text-[13.5px] text-bad">{quiz.error}</p>
          </Card>
        )}

        {quiz.questions && (
          <Card className="anim-in" padded={false}>
            <div className="p-4">
              <Quiz questions={quiz.questions} subjectId={subjectId} />
            </div>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <p className="text-[13px] font-medium text-ink">Kufiri i ndihmës</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Asistenti nuk t&apos;i jep përgjigjet e gatshme të detyrave. Të udhëzon me pyetje,
          shembuj të ngjashëm dhe praktikë — që ta mbash dijen edhe në provim.
        </p>
        <Link href="/ai" className="mt-3 inline-block">
          <Button size="sm" variant="ai">
            Hap bisedën e plotë
          </Button>
        </Link>
      </Card>
    </div>
  );
}
