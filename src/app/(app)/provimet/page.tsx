"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Sparkles, Target } from "lucide-react";
import { useStore } from "@/lib/store";
import { dayMonth, daysBetween, dur, longDate } from "@/lib/date";
import { examReadiness, examTopicsDone } from "@/lib/planner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Progress,
  Ring,
  SubjectDot,
  Thinking,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import type { Exam } from "@/lib/types";

export default function ExamsPage() {
  const { state, today } = useStore();
  const upcoming = state.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = state.exams.filter((e) => e.date < today);

  return (
    <div>
      <PageHeader title="Provimet" question="Sa gati jam?" />

      {upcoming.length === 0 ? (
        <EmptyState title="Pa provime" body="Kur të shtosh një provim, këtu shfaqet gatishmëria." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {upcoming.map((e, i) => (
            <ExamCard key={e.id} exam={e} index={i} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-[15px] font-semibold text-ink">Të kaluara</h2>
          <div className="flex flex-col gap-2">
            {past.map((e) => {
              const subject = state.subjects.find((s) => s.id === e.subjectId);
              return (
                <Card key={e.id} className="flex items-center justify-between gap-3 py-3.5">
                  <span className="text-[13.5px] text-muted">
                    {subject?.name} — {e.title}
                  </span>
                  <span className="num text-[12.5px] text-faint">{dayMonth(e.date)}</span>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExamCard({ exam, index }: { exam: Exam; index: number }) {
  const { state, today, refresh } = useStore();
  const toast = useToast();
  const [prep, setPrep] = useState(false);

  const subject = state.subjects.find((s) => s.id === exam.subjectId)!;
  const c = useTone(subject.tone);
  const readiness = examReadiness(state, exam);
  const topics = examTopicsDone(state, exam);
  const days = daysBetween(today, exam.date);

  const ringColor =
    readiness >= 75 ? "var(--ok)" : readiness >= 50 ? "var(--warn)" : "var(--bad)";

  const weak = subject.topics.filter((t) => t.mastery <= 1);
  const sessionsNeeded = Math.max(2, Math.ceil(weak.length * 0.9));

  const [busy, setBusy] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  /** Asks the model for an exam-focused plan, validated before it is stored. */
  async function buildPlan() {
    setBusy(true);
    setPrepError(null);

    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, from: today, days: Math.max(1, Math.min(14, days)) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPrepError(data.error ?? "Gjenerimi dështoi.");
        return;
      }

      await refresh();
      toast(`AI shtoi ${data.created} sesione përgatitjeje.`);
      setPrep(false);
    } catch {
      setPrepError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className={`anim-in anim-delay-${Math.min(index + 1, 5)}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SubjectDot toneIndex={subject.tone} />
              <span className="text-[12.5px] uppercase tracking-[0.05em] text-muted">
                {subject.name}
              </span>
            </div>
            <h3 className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {exam.title}
            </h3>
            <p className="num mt-1 text-[13px] text-muted">{longDate(exam.date)} · {exam.start}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-faint">
              <MapPin size={11} />
              {exam.room}
            </p>
          </div>

          <div className="flex flex-col items-center">
            <Ring value={readiness} size={78} stroke={7} color={ringColor}>
              <span className="num text-[18px] font-semibold text-ink">{readiness}%</span>
              <span className="text-[10px] text-faint">gatishmëri</span>
            </Ring>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-sunken/60 px-3.5 py-3">
          <Metric label="Mbetur" value={days === 0 ? "Sot" : `${days} ditë`} />
          <Metric label="Temat" value={`${topics.done}/${topics.total}`} />
          <Metric label="Mësim" value={dur(exam.studiedMinutes)} />
        </div>

        <div className="mt-3.5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12px] text-muted">Temat e mbuluara</span>
            <span className="num text-[12px] text-faint">
              {Math.round((topics.done / Math.max(1, topics.total)) * 100)}%
            </span>
          </div>
          <Progress value={(topics.done / Math.max(1, topics.total)) * 100} color={c.fg} />
        </div>

        <div className="mt-3.5 flex items-start gap-2 rounded-[10px] bg-ai-soft/45 px-3 py-2.5">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-ai" />
          <p className="text-[12.5px] leading-relaxed text-ink">
            {readiness >= 80
              ? `Je në rrugë të mirë. Mjaftojnë dy përsëritje të shkurtra para ${dayMonth(exam.date)}.`
              : days <= 3
                ? `Kanë mbetur vetëm ${days} ditë. Përqendrohu te ${weak.slice(0, 2).map((t) => t.name).join(" dhe ")} — aty humb më së shumti pikë.`
                : `Për notën ${exam.targetGrade} të duhen rreth ${sessionsNeeded} sesione deri atëherë, me fokus te temat ende të pambuluara.`}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setPrep(true)}>
            <Target size={13} />
            Përgatitu me AI
          </Button>
          <Badge tone={days <= 3 ? "bad" : days <= 7 ? "warn" : "neutral"}>
            <CalendarClock size={11} />
            {dayMonth(exam.date)}
          </Badge>
          <span className="num ml-auto text-[12.5px] text-faint">
            objektivi {exam.targetGrade}
          </span>
        </div>
      </Card>

      <Modal
        open={prep}
        onClose={() => setPrep(false)}
        title={`Plan përgatitjeje — ${subject.name}`}
        footer={
          <>
            <Button onClick={() => setPrep(false)}>Anulo</Button>
            <Button variant="primary" onClick={buildPlan} disabled={busy}>
              {busy ? "AI po planifikon…" : "Gjenero me AI"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          AI do të ndërtojë një plan deri te {dayMonth(exam.date)}, duke nisur nga temat më të
          dobëta dhe duke respektuar orarin dhe kohën tënde të lirë.
        </p>

        {busy && (
          <div className="mt-3">
            <Thinking label="Po ndërtoj planin e përgatitjes…" />
          </div>
        )}

        {prepError && (
          <p className="mt-3 rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
            {prepError}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-1.5">
          {weak.slice(0, 8).map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-[9px] border border-line px-3 py-2"
            >
              <span className="num w-5 text-[12px] text-faint">{i + 1}</span>
              <span className="flex-1 truncate text-[13.5px] text-ink">{t.name}</span>
              <Badge tone={t.mastery === 0 ? "bad" : "warn"}>
                {t.mastery === 0 ? "Nuk e di" : "Pak"}
              </Badge>
            </div>
          ))}
          {weak.length === 0 && (
            <p className="text-[13px] text-muted">
              Të gjitha temat janë të mbuluara — do të shtoj vetëm përsëritje.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.04em] text-faint">{label}</p>
      <p className={cx("num mt-0.5 text-[15px] font-semibold text-ink")}>{value}</p>
    </div>
  );
}
