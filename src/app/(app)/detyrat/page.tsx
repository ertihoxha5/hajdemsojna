"use client";

import { useState } from "react";
import { Check, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { dayMonth, daysBetween, dur, relativeDays } from "@/lib/date";
import { findSlot } from "@/lib/planner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Progress,
  Segmented,
  SubjectDot,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import type { Assignment } from "@/lib/types";

type Filter = "hapura" | "krejt" | "perfunduara";

export default function AssignmentsPage() {
  const { state, today } = useStore();
  const [filter, setFilter] = useState<Filter>("hapura");

  const all = [...state.assignments].sort((a, b) => a.due.localeCompare(b.due));
  const items =
    filter === "hapura" ? all.filter((a) => !a.done) : filter === "perfunduara" ? all.filter((a) => a.done) : all;

  const overdue = all.filter((a) => !a.done && a.due < today).length;
  const thisWeek = all.filter(
    (a) => !a.done && daysBetween(today, a.due) >= 0 && daysBetween(today, a.due) <= 7
  ).length;

  return (
    <div>
      <PageHeader
        title="Detyrat"
        question="Çfarë duhet dorëzuar dhe kur?"
        right={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { key: "hapura", label: "Të hapura" },
              { key: "perfunduara", label: "Të dorëzuara" },
              { key: "krejt", label: "Të gjitha" },
            ]}
          />
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Kjo javë</p>
          <p className="num mt-1 text-[22px] font-semibold text-ink">{thisWeek}</p>
        </Card>
        <Card>
          <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Në vonesë</p>
          <p className={cx("num mt-1 text-[22px] font-semibold", overdue ? "text-bad" : "text-ink")}>
            {overdue}
          </p>
        </Card>
        <Card>
          <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Punë e mbetur</p>
          <p className="num mt-1 text-[22px] font-semibold text-ink">
            {dur(
              all
                .filter((a) => !a.done)
                .reduce((s, a) => s + Math.round((a.estMinutes * (100 - a.progress)) / 100), 0)
            )}
          </p>
        </Card>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Asgjë këtu"
          body={filter === "hapura" ? "Të gjitha detyrat janë dorëzuar. Punë e mirë." : "Ende pa detyra."}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a, i) => (
            <AssignmentCard key={a.id} assignment={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment: a, index }: { assignment: Assignment; index: number }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const subject = state.subjects.find((s) => s.id === a.subjectId)!;
  const c = useTone(subject.tone);

  const daysLeft = daysBetween(today, a.due);
  const remaining = Math.round((a.estMinutes * (100 - a.progress)) / 100);
  const perDay = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining;

  const tone = a.done ? "ok" : daysLeft < 0 ? "bad" : daysLeft <= 2 ? "warn" : "neutral";

  return (
    <Card className={`anim-in anim-delay-${Math.min(index + 1, 5)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SubjectDot toneIndex={subject.tone} />
            <span className="text-[12.5px] text-muted">{subject.name}</span>
          </div>
          <h3
            className={cx(
              "mt-1 text-[16px] font-semibold tracking-[-0.02em] text-ink",
              a.done && "line-through decoration-faint"
            )}
          >
            {a.title}
          </h3>
          {a.detail && <p className="mt-1 text-[13px] leading-relaxed text-muted">{a.detail}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={tone}>
            {a.done ? "Dorëzuar" : `${relativeDays(today, a.due)} · ${dayMonth(a.due)}`}
          </Badge>
          <span className="num text-[13px] font-semibold text-ink">{a.progress}%</span>
        </div>
      </div>

      <Progress value={a.progress} className="mt-3.5" color={a.done ? "var(--ok)" : c.fg} />

      {a.steps.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {a.steps.map((s) => (
            <button
              key={s.id}
              onClick={() => dispatch({ type: "assignment/step", id: a.id, stepId: s.id })}
              className="flex items-center gap-2.5 text-left text-[13px]"
            >
              <span
                className={cx(
                  "flex h-4 w-4 items-center justify-center rounded-[5px] border transition-all",
                  s.done ? "border-ok bg-ok text-white" : "border-line hover:border-brand"
                )}
              >
                {s.done && <Check size={11} />}
              </span>
              <span className={cx(s.done ? "text-faint line-through" : "text-ink")}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {!a.done && (
        <>
          <div className="mt-3.5 flex items-start gap-2 rounded-[10px] bg-ai-soft/45 px-3 py-2.5">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-ai" />
            <p className="text-[12.5px] leading-relaxed text-ink">
              {daysLeft < 0
                ? `Është ${Math.abs(daysLeft)} ditë në vonesë. Ndaje në dy blloqe nga ${dur(Math.round(remaining / 2))} dhe mbylle sot.`
                : daysLeft === 0
                  ? `Skadon sot — kanë mbetur rreth ${dur(remaining)} punë.`
                  : `Për ta përfunduar me kohë, puno rreth ${dur(perDay)} në ditë deri të ${dayMonth(a.due)}.`}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const minutes = Math.min(60, Math.max(30, perDay || 45));
                const slot = findSlot(state, today, minutes);
                if (!slot) {
                  toast("Nuk gjeta kohë të lirë këtë javë.");
                  return;
                }
                dispatch({
                  type: "session/add",
                  session: {
                    id: `ps-${Date.now().toString(36)}`,
                    subjectId: a.subjectId,
                    kind: "detyre",
                    title: a.title,
                    objective: a.steps.find((s) => !s.done)?.label ?? "Finalizo dhe dorëzo",
                    date: slot.date,
                    start: slot.start,
                    minutes,
                    status: "planned",
                    why: `Afati është ${relativeDays(today, a.due)}.`,
                    linkedId: a.id,
                  },
                });
                toast(`U shtua një sesion ${dayMonth(slot.date)} në ${slot.start}.`);
              }}
            >
              <Plus size={13} />
              Planifiko punë
            </Button>
            <Button
              size="sm"
              onClick={() => {
                dispatch({ type: "assignment/done", id: a.id });
                toast("Detyra u shënua si e dorëzuar.");
              }}
            >
              <Check size={13} />
              Shëno si të dorëzuar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
