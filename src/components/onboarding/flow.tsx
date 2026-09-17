"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Plus,
  School,
  Sparkles,
  Target,
  Trash,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DAYS_LONG, addDays } from "@/lib/date";
import { cx } from "@/components/ui";

/* ============================================================
   Local shapes — flat, so the whole flow is one POST at the end
   ============================================================ */

type LearnerType = "universitet" | "shkolle" | "bootcamp" | "vetemesim";

interface DraftSubject {
  name: string;
  teacher: string;
  room: string;
  difficulty: number;
  importance: number;
  targetGrade: number;
}

interface DraftLecture {
  subjectIndex: number;
  day: number;
  start: string;
  end: string;
  kind: "ligjerate" | "ushtrime" | "lab" | "seminar";
  room: string;
}

interface DraftExam {
  subjectIndex: number;
  title: string;
  date: string;
  start: string;
}

interface Window {
  day: number;
  from: string;
  to: string;
}

const LEVELS: { key: LearnerType; label: string; sub: string; icon: React.ElementType }[] = [
  {
    key: "universitet",
    label: "Student universiteti",
    sub: "Ligjërata, ushtrime, kolokviume",
    icon: GraduationCap,
  },
  { key: "shkolle", label: "Nxënës", sub: "Shkollë e mesme ose gjimnaz", icon: School },
  { key: "bootcamp", label: "Bootcamp", sub: "Program intensiv me afate", icon: Users },
  { key: "vetemesim", label: "Vetë-mësim", sub: "Mëson vetë, me ritmin tënd", icon: BookOpen },
];

const GOALS: { key: string; label: string }[] = [
  { key: "kaloj-provimet", label: "Kaloj provimet" },
  { key: "permiresoj-notat", label: "Përmirësoj notat" },
  { key: "mesoj-rregullisht", label: "Mësoj rregullisht" },
  { key: "afati", label: "Përgatitem për afatin" },
  { key: "matura", label: "Përgatitem për maturë" },
  { key: "detyrat-me-kohe", label: "Përfundoj detyrat me kohë" },
];

const STEPS = ["Çfarë je", "Lëndët", "Orari", "Koha jote", "Provimet", "Objektivat"];

const TONES = ["#5a54f3", "#0f9488", "#c2740a", "#d0456c", "#a21caf"];

/* ============================================================
   Flow
   ============================================================ */

export function OnboardingFlow({ firstName, today }: { firstName: string; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"form" | "saving" | "planning">("form");
  const [error, setError] = useState<string | null>(null);

  const [learnerType, setLearnerType] = useState<LearnerType>("universitet");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");
  const [subjects, setSubjects] = useState<DraftSubject[]>([]);
  const [lectures, setLectures] = useState<DraftLecture[]>([]);
  const [exams, setExams] = useState<DraftExam[]>([]);
  const [windows, setWindows] = useState<Window[]>([
    { day: 0, from: "17:00", to: "20:00" },
    { day: 1, from: "17:00", to: "20:00" },
    { day: 2, from: "17:00", to: "20:00" },
    { day: 3, from: "17:00", to: "20:00" },
  ]);
  const [sessionLength, setSessionLength] = useState(45);
  const [breakLength, setBreakLength] = useState(15);
  const [maxMinutesPerDay, setMaxMinutesPerDay] = useState(180);
  const [goals, setGoals] = useState<string[]>(["kaloj-provimet"]);

  const canContinue =
    step === 1 ? subjects.length > 0 : step === 3 ? windows.length > 0 : step === 5 ? goals.length > 0 : true;

  async function finish() {
    setError(null);
    setPhase("saving");

    const payload = {
      learnerType,
      institution,
      year,
      subjects: subjects.map((s) => ({
        name: s.name,
        teacher: s.teacher,
        room: s.room,
        difficulty: s.difficulty,
        importance: s.importance,
        targetGrade: s.targetGrade,
      })),
      lectures,
      exams,
      availability: {
        windows,
        sessionLength,
        breakLength,
        maxMinutesPerDay,
        freeDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !windows.some((w) => w.day === d)),
      },
      goals,
    };

    try {
      const save = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!save.ok) {
        const data = await save.json().catch(() => ({}));
        throw new Error(data.error ?? "Ruajtja dështoi.");
      }

      // The account is set up; the plan is a best-effort extra on top.
      setPhase("planning");
      const plan = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: today, days: 7 }),
      });

      if (!plan.ok) {
        const data = await plan.json().catch(() => ({}));
        // Onboarding itself succeeded, so continue into the app and say what
        // happened there rather than trapping the student on this screen.
        router.replace(
          `/sot?plan=failed&reason=${encodeURIComponent(data.error ?? "AI nuk u përgjigj.")}`
        );
        router.refresh();
        return;
      }

      router.replace("/sot?plan=ok");
      router.refresh();
    } catch (e) {
      setPhase("form");
      setError(e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
    }
  }

  if (phase !== "form") {
    return <GeneratingScreen phase={phase} />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5">
          <Wordmark size={28} href={null} tagline="Mëso më zgjuar me AI" />
          <span className="ml-auto text-[13px] text-muted">Përshëndetje, {firstName}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-8">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">
              Hapi {step + 1} nga {STEPS.length} · {STEPS[step]}
            </span>
            <span className="num text-[12.5px] text-faint">
              {Math.round(((step + 1) / STEPS.length) * 100)}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="anim-pop mb-5 flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-bad" />
            <p className="text-[13px] leading-relaxed text-bad">{error}</p>
          </div>
        )}

        <div key={step} className="anim-in">
          {step === 0 && (
            <StepLevel
              value={learnerType}
              onChange={setLearnerType}
              institution={institution}
              setInstitution={setInstitution}
              year={year}
              setYear={setYear}
            />
          )}
          {step === 1 && <StepSubjects subjects={subjects} setSubjects={setSubjects} />}
          {step === 2 && (
            <StepTimetable
              subjects={subjects}
              lectures={lectures}
              setLectures={setLectures}
            />
          )}
          {step === 3 && (
            <StepAvailability
              windows={windows}
              setWindows={setWindows}
              sessionLength={sessionLength}
              setSessionLength={setSessionLength}
              breakLength={breakLength}
              setBreakLength={setBreakLength}
              maxMinutesPerDay={maxMinutesPerDay}
              setMaxMinutesPerDay={setMaxMinutesPerDay}
            />
          )}
          {step === 4 && (
            <StepExams subjects={subjects} exams={exams} setExams={setExams} today={today} />
          )}
          {step === 5 && <StepGoals goals={goals} setGoals={setGoals} />}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] px-3 text-[14px] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
          >
            <ArrowLeft size={15} />
            Mbrapa
          </button>

          {step < STEPS.length - 1 ? (
            <button
              disabled={!canContinue}
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-45"
            >
              Vazhdo
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              disabled={!canContinue}
              onClick={finish}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-45"
            >
              <Sparkles size={16} />
              Krijo planin tim me AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Generating screen
   ============================================================ */

const PLANNING_LINES = [
  "Po ruaj lëndët dhe orarin tënd…",
  "Po analizoj orarin tënd…",
  "Po kontrolloj provimet dhe afatet…",
  "Po krijoj planin tënd…",
];

function GeneratingScreen({ phase }: { phase: "saving" | "planning" }) {
  const [line, setLine] = useState(0);

  // Cycle the status text while the request is in flight.
  useEffect(() => {
    const timer = setInterval(() => setLine((l) => l + 1), 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-ai-soft text-ai">
        <Sparkles size={22} />
      </div>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Po e ndërtoj planin tënd
        </h1>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
          {phase === "saving" ? PLANNING_LINES[0] : PLANNING_LINES[(line % 3) + 1]}
        </p>
      </div>
      <div className="h-1 w-56 overflow-hidden rounded-full bg-line">
        <div className="generating h-full w-full" />
      </div>
    </div>
  );
}

/* ============================================================
   Steps
   ============================================================ */

function StepLevel({
  value,
  onChange,
  institution,
  setInstitution,
  year,
  setYear,
}: {
  value: LearnerType;
  onChange: (v: LearnerType) => void;
  institution: string;
  setInstitution: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
}) {
  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">Çfarë je?</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Kjo përcakton si e ndërtojmë orarin dhe planin tënd.
      </p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => onChange(l.key)}
            className={cx(
              "flex items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-all",
              value === l.key
                ? "border-brand bg-brand-soft shadow-[var(--shadow-sm)]"
                : "border-line bg-surface hover:border-brand/40"
            )}
          >
            <span
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]",
                value === l.key ? "bg-brand text-white" : "bg-sunken text-muted"
              )}
            >
              <l.icon size={17} />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium text-ink">{l.label}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{l.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Labelled label="Institucioni" hint="Opsionale">
          <Input
            value={institution}
            onChange={setInstitution}
            placeholder="p.sh. Universiteti i Prishtinës"
          />
        </Labelled>
        <Labelled label="Viti / klasa" hint="Opsionale">
          <Input value={year} onChange={setYear} placeholder="p.sh. Viti 2" />
        </Labelled>
      </div>
    </div>
  );
}

function StepSubjects({
  subjects,
  setSubjects,
}: {
  subjects: DraftSubject[];
  setSubjects: (s: DraftSubject[]) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  function add() {
    if (!name.trim()) return;
    setSubjects([
      ...subjects,
      {
        name: name.trim(),
        teacher: "",
        room: "",
        difficulty: 3,
        importance: 3,
        targetGrade: 9,
      },
    ]);
    setName("");
  }

  function patch(i: number, p: Partial<DraftSubject>) {
    setSubjects(subjects.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">Shto lëndët</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Lëndët e këtij semestri. Detajet mund t&apos;i plotësosh edhe më vonë.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="p.sh. Algoritme"
          autoFocus
          className="h-11 flex-1 rounded-[10px] border border-line bg-surface px-3.5 text-[14.5px] text-ink outline-none focus:border-brand"
        />
        <button
          onClick={add}
          className="inline-flex h-11 items-center gap-1.5 rounded-[10px] bg-brand px-4 text-[14.5px] font-medium text-white transition-colors hover:bg-brand-deep"
        >
          <Plus size={15} />
          Shto
        </button>
      </div>

      {subjects.length === 0 ? (
        <p className="mt-4 rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-faint">
          Shto lëndën tënde të parë për të vazhduar.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {subjects.map((s, i) => (
            <div key={i} className="overflow-hidden rounded-[12px] border border-line bg-surface">
              <div className="flex w-full items-center gap-3 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: TONES[i % TONES.length] }}
                />
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {s.name}
                  </span>
                  <span className="block text-[12px] text-faint">
                    {s.teacher || "Pa profesor"} · vështirësia {s.difficulty}/5 · objektivi{" "}
                    {s.targetGrade}
                  </span>
                </button>
                <button
                  onClick={() => setSubjects(subjects.filter((_, idx) => idx !== i))}
                  aria-label="Fshij"
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-bad"
                >
                  <Trash size={14} />
                </button>
              </div>

              {open === i && (
                <div className="anim-fade grid gap-3 border-t border-line bg-canvas p-4 sm:grid-cols-2">
                  <Labelled label="Profesori">
                    <Input value={s.teacher} onChange={(v) => patch(i, { teacher: v })} />
                  </Labelled>
                  <Labelled label="Salla">
                    <Input value={s.room} onChange={(v) => patch(i, { room: v })} />
                  </Labelled>
                  <Labelled label="Vështirësia">
                    <Range
                      value={s.difficulty}
                      onChange={(v) => patch(i, { difficulty: v })}
                    />
                  </Labelled>
                  <Labelled label="Rëndësia">
                    <Range
                      value={s.importance}
                      onChange={(v) => patch(i, { importance: v })}
                    />
                  </Labelled>
                  <Labelled label="Nota e synuar">
                    <Input
                      type="number"
                      value={String(s.targetGrade)}
                      onChange={(v) => patch(i, { targetGrade: Number(v) || 9 })}
                    />
                  </Labelled>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepTimetable({
  subjects,
  lectures,
  setLectures,
}: {
  subjects: DraftSubject[];
  lectures: DraftLecture[];
  setLectures: (l: DraftLecture[]) => void;
}) {
  const [day, setDay] = useState(0);
  const [form, setForm] = useState({
    subjectIndex: 0,
    start: "09:00",
    end: "10:30",
    kind: "ligjerate" as DraftLecture["kind"],
    room: "",
  });

  const entries = lectures
    .map((l, idx) => ({ ...l, idx }))
    .filter((l) => l.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">Shto orarin</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Orët e fiksuara. Planifikuesi nuk do t&apos;i prekë kurrë këto blloqe.
      </p>

      <div className="no-scrollbar mt-6 flex gap-1.5 overflow-x-auto">
        {DAYS_LONG.slice(0, 6).map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={cx(
              "shrink-0 rounded-[9px] border px-3 py-1.5 text-[13px] font-medium transition-colors",
              day === i
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface text-muted hover:bg-sunken"
            )}
          >
            {d}
            {lectures.some((l) => l.day === i) && (
              <span className="num ml-1.5 text-[11px] text-faint">
                {lectures.filter((l) => l.day === i).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {entries.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">
            Ditë e lirë nga ligjëratat.
          </p>
        )}
        {entries.map((l) => (
          <div
            key={l.idx}
            className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-2.5"
          >
            <span className="num w-[92px] shrink-0 text-[12.5px] text-muted">
              {l.start}–{l.end}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
              {subjects[l.subjectIndex]?.name ?? "—"}
            </span>
            <span className="hidden text-[12px] text-faint sm:block">{l.room}</span>
            <button
              onClick={() => setLectures(lectures.filter((_, i) => i !== l.idx))}
              aria-label="Fshij"
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-bad"
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[12px] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Lënda">
            <Select
              value={String(form.subjectIndex)}
              onChange={(v) => setForm({ ...form, subjectIndex: Number(v) })}
              options={subjects.map((s, i) => ({ value: String(i), label: s.name }))}
            />
          </Labelled>
          <Labelled label="Lloji">
            <Select
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as DraftLecture["kind"] })}
              options={[
                { value: "ligjerate", label: "Ligjëratë" },
                { value: "ushtrime", label: "Ushtrime" },
                { value: "lab", label: "Laborator" },
                { value: "seminar", label: "Seminar" },
              ]}
            />
          </Labelled>
          <Labelled label="Fillon">
            <Input type="time" value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
          </Labelled>
          <Labelled label="Mbaron">
            <Input type="time" value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
          </Labelled>
          <Labelled label="Salla">
            <Input value={form.room} onChange={(v) => setForm({ ...form, room: v })} placeholder="B201" />
          </Labelled>
        </div>
        <button
          disabled={subjects.length === 0}
          onClick={() => setLectures([...lectures, { ...form, day }])}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-brand px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-45"
        >
          <Plus size={14} />
          Shto në {DAYS_LONG[day]}
        </button>
      </div>
    </div>
  );
}

function StepAvailability({
  windows,
  setWindows,
  sessionLength,
  setSessionLength,
  breakLength,
  setBreakLength,
  maxMinutesPerDay,
  setMaxMinutesPerDay,
}: {
  windows: Window[];
  setWindows: (w: Window[]) => void;
  sessionLength: number;
  setSessionLength: (v: number) => void;
  breakLength: number;
  setBreakLength: (v: number) => void;
  maxMinutesPerDay: number;
  setMaxMinutesPerDay: (v: number) => void;
}) {
  function toggle(day: number) {
    const has = windows.some((w) => w.day === day);
    setWindows(
      has
        ? windows.filter((w) => w.day !== day)
        : [...windows, { day, from: "17:00", to: "20:00" }]
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Kur mundesh me mësu?
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Sesionet planifikohen vetëm brenda kësaj kohe — asnjëherë mbi ligjërata.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {DAYS_LONG.map((label, day) => {
          const w = windows.find((x) => x.day === day);
          return (
            <div
              key={label}
              className={cx(
                "flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-2.5",
                w ? "border-line bg-surface" : "border-dashed border-line"
              )}
            >
              <button
                onClick={() => toggle(day)}
                className={cx(
                  "flex w-32 items-center gap-2 text-left text-[13.5px] font-medium",
                  w ? "text-ink" : "text-faint"
                )}
              >
                <span
                  className={cx(
                    "flex h-4 w-4 items-center justify-center rounded-[5px] border",
                    w ? "border-brand bg-brand text-white" : "border-line"
                  )}
                >
                  {w && <Check size={11} />}
                </span>
                {label}
              </button>

              {w && (
                <>
                  <input
                    type="time"
                    value={w.from}
                    onChange={(e) =>
                      setWindows(
                        windows.map((x) => (x.day === day ? { ...x, from: e.target.value } : x))
                      )
                    }
                    className="num h-9 w-28 rounded-[8px] border border-line bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-brand"
                  />
                  <span className="text-faint">–</span>
                  <input
                    type="time"
                    value={w.to}
                    onChange={(e) =>
                      setWindows(
                        windows.map((x) => (x.day === day ? { ...x, to: e.target.value } : x))
                      )
                    }
                    className="num h-9 w-28 rounded-[8px] border border-line bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-brand"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Labelled label="Gjatësia e sesionit">
          <Select
            value={String(sessionLength)}
            onChange={(v) => setSessionLength(Number(v))}
            options={[25, 30, 35, 45, 50, 60].map((m) => ({
              value: String(m),
              label: `${m} min`,
            }))}
          />
        </Labelled>
        <Labelled label="Pushimi">
          <Select
            value={String(breakLength)}
            onChange={(v) => setBreakLength(Number(v))}
            options={[5, 10, 15, 20].map((m) => ({ value: String(m), label: `${m} min` }))}
          />
        </Labelled>
        <Labelled label="Maksimumi në ditë">
          <Select
            value={String(maxMinutesPerDay)}
            onChange={(v) => setMaxMinutesPerDay(Number(v))}
            options={[60, 90, 120, 150, 180, 240].map((m) => ({
              value: String(m),
              label: `${m / 60} orë`,
            }))}
          />
        </Labelled>
      </div>
    </div>
  );
}

function StepExams({
  subjects,
  exams,
  setExams,
  today,
}: {
  subjects: DraftSubject[];
  exams: DraftExam[];
  setExams: (e: DraftExam[]) => void;
  today: string;
}) {
  const [form, setForm] = useState({
    subjectIndex: 0,
    title: "Kolokviumi i parë",
    date: addDays(today, 14),
    start: "09:00",
  });

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Provimet e rëndësishme
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Shto provimet që të presin. AI i përdor për të vendosur çfarë vjen e para. Mund ta kapërcesh
        këtë hap.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {exams.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">
            Nuk ke provime të regjistruara.
          </p>
        )}
        {exams.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-2.5"
          >
            <GraduationCap size={15} className="shrink-0 text-bad" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{e.title}</span>
              <span className="block text-[12px] text-faint">
                {subjects[e.subjectIndex]?.name} · {e.date}
              </span>
            </span>
            <button
              onClick={() => setExams(exams.filter((_, idx) => idx !== i))}
              aria-label="Fshij"
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-bad"
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[12px] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Lënda">
            <Select
              value={String(form.subjectIndex)}
              onChange={(v) => setForm({ ...form, subjectIndex: Number(v) })}
              options={subjects.map((s, i) => ({ value: String(i), label: s.name }))}
            />
          </Labelled>
          <Labelled label="Titulli">
            <Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          </Labelled>
          <Labelled label="Data">
            <Input type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </Labelled>
          <Labelled label="Ora">
            <Input type="time" value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
          </Labelled>
        </div>
        <button
          disabled={subjects.length === 0 || !form.title.trim()}
          onClick={() => setExams([...exams, form])}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-brand px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-45"
        >
          <Plus size={14} />
          Shto provimin
        </button>
      </div>
    </div>
  );
}

function StepGoals({
  goals,
  setGoals,
}: {
  goals: string[];
  setGoals: (g: string[]) => void;
}) {
  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">Çfarë synon?</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Zgjedh një ose disa. Këto peshojnë në renditjen e prioriteteve.
      </p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {GOALS.map((g) => {
          const on = goals.includes(g.key);
          return (
            <button
              key={g.key}
              onClick={() =>
                setGoals(on ? goals.filter((x) => x !== g.key) : [...goals, g.key])
              }
              className={cx(
                "flex items-center gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-all",
                on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40"
              )}
            >
              <span
                className={cx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                  on ? "border-brand bg-brand text-white" : "border-line"
                )}
              >
                {on && <Check size={12} />}
              </span>
              <span className="text-[14px] font-medium text-ink">{g.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-[12px] border border-ai/25 bg-ai-soft/40 p-4">
        <div className="flex items-start gap-3">
          <Target size={16} className="mt-0.5 shrink-0 text-ai" />
          <p className="text-[13.5px] leading-relaxed text-ink">
            Kur të shtypësh &ldquo;Krijo planin tim me AI&rdquo;, gjithçka ruhet në llogarinë tënde
            dhe AI ndërton javën e parë duke peshuar provimet, afatet dhe kohën që ke vërtet të
            lirë.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Small inputs
   ============================================================ */

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-muted">
        {label}
        {hint && <span className="ml-1.5 text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-[9px] border border-line bg-canvas px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full cursor-pointer rounded-[9px] border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Range({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={cx(
            "num h-10 flex-1 rounded-[8px] border text-[13px] font-medium transition-colors",
            value === n ? "border-brand bg-brand text-white" : "border-line text-muted hover:bg-sunken"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
