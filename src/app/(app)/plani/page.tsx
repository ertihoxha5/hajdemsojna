"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  DAYS_LONG,
  addDays,
  dayIndex,
  dur,
  parseISO,
  weekStart,
} from "@/lib/date";
import {
  agendaFor,
  dailyBudget,
  freeBlocks,
  priorities,
  weekStats,
} from "@/lib/planner";
import { timeOf } from "@/lib/date";
import {
  Badge,
  Button,
  Card,
  IconButton,
  PageHeader,
  Progress,
  Segmented,
  SubjectDot,
  Thinking,
  cx,
  useToast,
} from "@/components/ui";
import { AgendaRow } from "@/components/app/session-row";
import { WeekGrid } from "@/components/app/week-grid";

export default function PlannerPage() {
  const { state, dispatch, today, now, refresh } = useStore();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"liste" | "rrjet">("liste");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genNote, setGenNote] = useState<string | null>(null);

  const start = weekStart(addDays(today, offset * 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const ranked = priorities(state, today);
  const ws = weekStats(state, start);

  const plannedMinutes = days
    .flatMap((d) => agendaFor(state, d))
    .filter((i) => i.type === "session" && i.kind !== "pushim")
    .reduce((s, i) => s + i.minutes, 0);

  /** Asks the model for the week, validated server-side before it is stored. */
  async function generateWithAI() {
    setGenerating(true);
    setGenError(null);
    setGenNote(null);

    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: start, days: 7 }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setGenError(data.error ?? "Gjenerimi dështoi.");
        return;
      }

      await refresh();
      toast(`AI planifikoi ${data.created} sesione.`);
      if (Array.isArray(data.rejected) && data.rejected.length) {
        setGenNote(
          `${data.rejected.length} sesione u refuzuan sepse nuk përshtateshin me orarin tënd.`
        );
      }
    } catch {
      setGenError("Lidhja dështoi. Kontrollo internetin dhe provo përsëri.");
    } finally {
      setGenerating(false);
    }
  }

  /** The deterministic planner — instant, and works with no AI configured. */
  function generateWithRules() {
    setGenError(null);
    setGenNote(null);
    dispatch({ type: "plan/generate", from: start });
    toast("Plani u ndërtua nga rregullat e planifikimit.");
  }

  return (
    <div>
      <PageHeader
        title="Plani i javës"
        question="Çka duhet të mësoj dhe kur?"
        right={
          <>
            <Segmented
              value={view}
              onChange={(v) => setView(v as "liste" | "rrjet")}
              options={[
                { key: "liste", label: "Listë" },
                { key: "rrjet", label: "Rrjet" },
              ]}
            />
            <Button onClick={generateWithRules} disabled={generating}>
              Plan i shpejtë
            </Button>
            <Button variant="primary" onClick={generateWithAI} disabled={generating}>
              <Sparkles size={14} />
              {generating ? "AI po planifikon…" : "Gjenero me AI"}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Java e kaluar" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton label="Java tjetër" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight size={16} />
          </IconButton>
          <span className="ml-2 text-[14.5px] font-medium text-ink">
            {offset === 0 ? "Kjo javë" : offset === 1 ? "Java tjetër" : offset === -1 ? "Java e kaluar" : `${parseISO(start).getDate()} ${DAYS_LONG[0]}`}
          </span>
          <span className="num ml-2 text-[13px] text-faint">{dur(plannedMinutes)} të planifikuara</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            dispatch({ type: "plan/rebalance", today });
            toast("Sesionet e humbura u rishpërndanë.");
          }}
        >
          <RotateCcw size={13} />
          Ribalanco të humburat
        </Button>
      </div>

      {generating && (
        <Card className="mb-4 border-ai/25 bg-ai-soft/30">
          <Thinking label="AI po analizon orarin, provimet dhe afatet e tua…" />
        </Card>
      )}

      {genError && (
        <Card className="anim-in mb-4 border-bad/30 bg-bad-soft">
          <p className="flex items-start gap-2 text-[13.5px] text-bad">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {genError}
          </p>
        </Card>
      )}

      {genNote && (
        <Card className="anim-in mb-4 border-warn/30 bg-warn-soft/50">
          <p className="text-[13px] text-ink">{genNote}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className={cx("min-w-0", generating && "generating rounded-[14px]")}>
          {view === "rrjet" ? (
            <WeekGrid days={days} showClasses />
          ) : (
            <div className="flex flex-col gap-5">
              {days.map((date) => {
                const items = agendaFor(state, date).filter(
                  (i) => i.type === "session" || i.type === "exam" || i.type === "group"
                );
                const budget = dailyBudget(state, date);
                const free = freeBlocks(state, date);
                const isToday = date === today;

                return (
                  <section key={date}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3
                        className={cx(
                          "text-[14.5px] font-semibold",
                          isToday ? "text-brand" : "text-ink"
                        )}
                      >
                        {DAYS_LONG[dayIndex(date)]}
                        <span className="num ml-2 text-[12.5px] font-normal text-faint">
                          {parseISO(date).getDate()}
                        </span>
                      </h3>
                      <span className="num text-[12px] text-faint">
                        {free.length === 0
                          ? "Ditë e lirë"
                          : `${dur(budget)} të disponueshme`}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="rounded-[12px] border border-dashed border-line px-4 py-4 text-[13px] text-faint">
                        {free.length === 0
                          ? "Ditë pushimi — pa sesione."
                          : `Kohë e lirë: ${free
                              .map((b) => `${timeOf(b.from)}–${timeOf(b.to)}`)
                              .join(", ")}`}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {items.map((i) => (
                          <AgendaRow key={i.id} item={i} now={isToday ? now : undefined} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Why this plan ──────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <Card className="border-ai/25 bg-ai-soft/30">
            <div className="flex items-center gap-2 text-ai">
              <Sparkles size={14} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
                Si u ndërtua ky plan
              </span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink">
              Secila lëndë merr një pikë prioriteti nga afërsia e provimit, afatet e detyrave,
              temat e pambuluara, vështirësia dhe objektivat e tua. Koha ndahet vetëm brenda
              orëve kur je i lirë.
            </p>
          </Card>

          <Card padded={false}>
            <div className="px-5 pb-3 pt-4">
              <p className="text-[13px] font-medium text-ink">Prioritetet</p>
            </div>
            <div className="divide-y divide-line">
              {ranked.map((p) => {
                const subject = state.subjects.find((s) => s.id === p.subjectId)!;
                const max = ranked[0].total || 1;
                return (
                  <div key={p.subjectId} className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <SubjectDot toneIndex={subject.tone} />
                      <span className="flex-1 truncate text-[13.5px] font-medium text-ink">
                        {subject.name}
                      </span>
                      <span className="num text-[12.5px] font-semibold text-muted">{p.total}</span>
                    </div>
                    <Progress value={(p.total / max) * 100} className="mt-2" height={4} />
                    <p className="mt-2 text-[12px] leading-relaxed text-muted">{p.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.parts.examUrgency > 4 && <Badge tone="bad">Provim</Badge>}
                      {p.parts.assignmentUrgency > 4 && <Badge tone="warn">Afat</Badge>}
                      {p.parts.weakness > 8 && <Badge>Tema të dobëta</Badge>}
                      {p.parts.recovery > 0 && <Badge tone="warn">Kompensim</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <p className="text-[13px] font-medium text-ink">Kjo javë deri tani</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="num text-[19px] font-semibold text-ink">{ws.label}</p>
                <p className="text-[12px] text-muted">mësim</p>
              </div>
              <div>
                <p className="num text-[19px] font-semibold text-ink">
                  {ws.done}/{ws.planned}
                </p>
                <p className="text-[12px] text-muted">sesione</p>
              </div>
            </div>
            {ws.missed > 0 && (
              <p className="mt-3 text-[12.5px] text-warn">
                {ws.missed} sesione të humbura — ribalancoji për t&apos;i rikthyer.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
