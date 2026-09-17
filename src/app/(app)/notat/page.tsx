"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash } from "lucide-react";
import { useStore } from "@/lib/store";
import { shortDate } from "@/lib/date";
import { currentGrade, neededOnRemaining } from "@/lib/planner";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  SubjectDot,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import type { GradeKind, Subject } from "@/lib/types";

const KINDS: { key: GradeKind; label: string }[] = [
  { key: "kuiz", label: "Kuiz" },
  { key: "detyre", label: "Detyrë" },
  { key: "gjysmefinal", label: "Gjysmëfinale" },
  { key: "final", label: "Provim final" },
  { key: "projekt", label: "Projekt" },
  { key: "pjesemarrje", label: "Pjesëmarrje" },
];

export default function GradesPage() {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);

  const weighted = state.subjects.reduce(
    (acc, s) => {
      const g = currentGrade(state, s.id);
      return { sum: acc.sum + g * s.credits, credits: acc.credits + s.credits };
    },
    { sum: 0, credits: 0 }
  );
  const gpa = weighted.credits ? weighted.sum / weighted.credits : 0;

  return (
    <div>
      <PageHeader
        title="Notat"
        question="Ku po shkoj dhe çfarë më duhet?"
        right={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Shto notë
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[12px] uppercase tracking-[0.05em] text-faint">
              Mesatarja e ponderuar
            </p>
            <p className="num mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {gpa.toFixed(2)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              sipas {weighted.credits} ECTS · {state.grades.length} vlerësime
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {state.subjects.map((s) => (
              <div key={s.id} className="text-right">
                <p className="text-[11.5px] text-muted">{s.short}</p>
                <p className="num text-[17px] font-semibold text-ink">
                  {currentGrade(state, s.id).toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {state.subjects.map((s) => (
          <SubjectGrades key={s.id} subject={s} />
        ))}
      </div>

      <AddGrade open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function SubjectGrades({ subject }: { subject: Subject }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const c = useTone(subject.tone);
  const grades = state.grades
    .filter((g) => g.subjectId === subject.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const grade = currentGrade(state, subject.id);
  const need = neededOnRemaining(state, subject);
  const gap = subject.targetGrade - grade;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <SubjectDot toneIndex={subject.tone} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {subject.name}
          </span>
          <Badge tone={gap <= 0 ? "ok" : gap > 1.5 ? "bad" : "warn"}>
            {gap <= 0 ? "Mbi objektiv" : `−${gap.toFixed(1)} nga objektivi`}
          </Badge>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.04em] text-faint">Aktuale</p>
            <p className="num text-[19px] font-semibold leading-tight" style={{ color: c.fg }}>
              {grade.toFixed(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.04em] text-faint">Objektivi</p>
            <p className="num text-[19px] font-semibold leading-tight text-muted">
              {subject.targetGrade.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Grade meter against the target — one number, read at a glance */}
      <div className="px-5 pt-4">
        <div className="relative">
          <Progress value={(grade / 10) * 100} color={c.fg} height={8} />
          <span
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
            style={{ left: `${(subject.targetGrade / 10) * 100}%` }}
            title={`Objektivi ${subject.targetGrade}`}
          />
        </div>
        <div className="num mt-1.5 flex justify-between text-[11px] text-faint">
          <span>5</span>
          <span>Objektivi {subject.targetGrade}</span>
          <span>10</span>
        </div>
      </div>

      <div className="divide-y divide-line px-5">
        {grades.map((g) => (
          <div key={g.id} className="group flex items-center gap-3 py-2.5">
            <Badge>{KINDS.find((k) => k.key === g.kind)?.label ?? g.kind}</Badge>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{g.title}</span>
            <span className="num hidden text-[12px] text-faint sm:block">{shortDate(g.date)}</span>
            <span className="num w-9 text-[12px] text-muted">{Math.round(g.weight * 100)}%</span>
            <span
              className={cx(
                "num w-9 text-right text-[15px] font-semibold",
                g.value >= 9 ? "text-ok" : g.value >= 7 ? "text-ink" : "text-warn"
              )}
            >
              {g.value}
            </span>
            <IconButton
              label="Fshij"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => {
                dispatch({ type: "grade/remove", id: g.id });
                toast("Nota u hoq.");
              }}
            >
              <Trash size={13} />
            </IconButton>
          </div>
        ))}
        {grades.length === 0 && (
          <p className="py-4 text-[13px] text-muted">Ende pa vlerësime për këtë lëndë.</p>
        )}
      </div>

      <div className="mx-5 mb-4 mt-2 flex items-start gap-2 rounded-[10px] bg-ai-soft/45 px-3 py-2.5">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-ai" />
        <p className="text-[12.5px] leading-relaxed text-ink">
          {need == null
            ? "Të gjitha vlerësimet janë mbyllur për këtë lëndë."
            : need.secured
              ? `Objektivi ${subject.targetGrade} është siguruar tashmë me pikët ekzistuese.`
              : need.reachable
                ? `Për një notë finale ${subject.targetGrade}, të duhet afërsisht ${need.need} në ${need.remainingWeight}% e mbetur të vlerësimit.`
                : `Objektivi ${subject.targetGrade} nuk arrihet më matematikisht. Synim realist: ${Math.floor((grade + 10) / 2)}.`}
        </p>
      </div>
    </Card>
  );
}

function AddGrade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({
    subjectId: state.subjects[0]?.id ?? "",
    kind: "kuiz" as GradeKind,
    title: "",
    value: 8,
    weight: 10,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shto notë"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.title.trim()) return;
              dispatch({
                type: "grade/add",
                grade: {
                  id: `g-${Date.now().toString(36)}`,
                  subjectId: form.subjectId,
                  kind: form.kind,
                  title: form.title.trim(),
                  value: form.value,
                  weight: form.weight / 100,
                  date: today,
                },
              });
              setForm({ ...form, title: "" });
              toast("Nota u shtua.");
              onClose();
            }}
          >
            Ruaj
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Lënda">
          <Select
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
          >
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lloji">
          <Select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as GradeKind })}
          >
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titulli">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="p.sh. Kuizi 2 — Indekset"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nota" hint="1 – 10">
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </Field>
          <Field label="Pesha" hint="% e notës finale">
            <Input
              type="number"
              min={1}
              max={100}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
