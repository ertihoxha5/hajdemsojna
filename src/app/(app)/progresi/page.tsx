"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  DAYS_SHORT,
  addDays,
  dayIndex,
  dur,
  parseISO,
  shortDate,
  weekStart,
} from "@/lib/date";
import {
  currentGrade,
  examReadiness,
  minutesStudied,
  subjectProgress,
  topicsDone,
  weekStats,
} from "@/lib/planner";
import { weeklyReview } from "@/lib/insights";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  Ring,
  Segmented,
  Stat,
  SubjectDot,
  cx,
  useTone,
  useToast,
} from "@/components/ui";

export default function ProgressPage() {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const [range, setRange] = useState<"jave" | "muaj">("jave");

  const ws = weekStats(state, weekStart(today));
  const review = weeklyReview(state, today);

  /** Minutes studied per day for the last 14 days. */
  const daily = useMemo(() => {
    const days = range === "jave" ? 14 : 30;
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, -(days - 1 - i));
      const minutes = state.sessions
        .filter((s) => s.date === date && s.status === "done")
        .reduce((sum, s) => sum + s.minutes, 0);
      return {
        date,
        label: range === "jave" ? DAYS_SHORT[dayIndex(date)] : `${parseISO(date).getDate()}`,
        minutes,
      };
    });
  }, [state.sessions, today, range]);

  const best = daily.reduce((m, d) => Math.max(m, d.minutes), 0);

  return (
    <div>
      <PageHeader
        title="Progresi"
        question="A po përmirësohem?"
        right={
          <Segmented
            value={range}
            onChange={(v) => setRange(v as "jave" | "muaj")}
            options={[
              { key: "jave", label: "2 javë" },
              { key: "muaj", label: "Muaj" },
            ]}
          />
        }
      />

      {/* ── Headline numbers ───────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Mësim këtë javë" value={ws.label} sub={`${ws.done} sesione të përfunduara`} />
        </Card>
        <Card>
          <Stat
            label="Sesione"
            value={`${ws.done} / ${ws.planned}`}
            sub={ws.missed ? `${ws.missed} të humbura` : "asnjë e humbur"}
            tone={ws.missed ? "warn" : "ok"}
          />
        </Card>
        <Card>
          <Stat
            label="Konsistenca"
            value={`${ws.consistency}%`}
            sub="sesione të kryera sipas planit"
            tone={ws.consistency >= 80 ? "ok" : ws.consistency >= 60 ? "warn" : "bad"}
          />
        </Card>
        <Card className="flex items-center gap-4">
          <Ring value={Math.min(100, (state.streak / 30) * 100)} size={56} stroke={6} color="var(--warn)">
            <Flame size={16} className="text-warn" />
          </Ring>
          <div>
            <p className="text-[12px] uppercase tracking-[0.05em] text-faint">Seria</p>
            <p className="num mt-1 text-[22px] font-semibold leading-none text-ink">
              {state.streak}
            </p>
            <p className="mt-1 text-[12px] text-muted">ditë rresht</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* ── Daily activity ─────────────────────────── */}
          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Koha e mësimit</h2>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  Minuta të përfunduara, {range === "jave" ? "14 ditët" : "30 ditët"} e fundit
                </p>
              </div>
              <span className="num text-[12.5px] text-faint">maks {dur(best)}</span>
            </div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--faint)", fontSize: 11 }}
                    interval={range === "jave" ? 0 : 4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--faint)", fontSize: 11 }}
                    width={44}
                    tickFormatter={(v: number) => (v ? `${v}m` : "")}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--sunken)" }}
                    content={<ChartTooltip unit="minuta" />}
                  />
                  <Bar
                    dataKey="minutes"
                    fill="var(--brand)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={range === "jave" ? 22 : 12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ── Grade trend ────────────────────────────── */}
          <GradeTrend />

          {/* ── Subject progress meters ────────────────── */}
          <Card padded={false}>
            <div className="px-5 pb-1 pt-4">
              <h2 className="text-[15px] font-semibold text-ink">Progresi sipas lëndëve</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                Temat e zotëruara ndaj totalit të temave
              </p>
            </div>
            <div className="divide-y divide-line">
              {[...state.subjects]
                .sort((a, b) => subjectProgress(b) - subjectProgress(a))
                .map((s) => (
                  <SubjectMeter key={s.id} subjectId={s.id} />
                ))}
            </div>
          </Card>

          {/* ── Exam readiness ─────────────────────────── */}
          <Card padded={false}>
            <div className="px-5 pb-1 pt-4">
              <h2 className="text-[15px] font-semibold text-ink">Gatishmëria për provime</h2>
            </div>
            <div className="divide-y divide-line">
              {state.exams
                .filter((e) => e.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((e) => {
                  const subject = state.subjects.find((s) => s.id === e.subjectId)!;
                  const r = examReadiness(state, e);
                  return (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <SubjectDot toneIndex={subject.tone} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                        {subject.name}
                      </span>
                      <div className="w-28 sm:w-44">
                        <Progress
                          value={r}
                          height={6}
                          color={r >= 75 ? "var(--ok)" : r >= 50 ? "var(--warn)" : "var(--bad)"}
                        />
                      </div>
                      <span className="num w-10 text-right text-[13px] font-semibold text-ink">
                        {r}%
                      </span>
                      <span className="num hidden w-16 text-right text-[12px] text-faint sm:block">
                        {shortDate(e.date)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* ── Weekly review ──────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <Card className="border-brand/25 bg-brand-soft/30">
            <div className="flex items-center gap-2 text-brand">
              <TrendingUp size={14} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
                Java jote
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5 text-[13.5px]">
              <ReviewRow label="Ke mësuar" value={review.minutes} />
              <ReviewRow label="Ke përfunduar" value={`${review.done} / ${review.planned} sesione`} />
              <ReviewRow label="Konsistenca" value={`${review.consistency}%`} />
              {review.bestSubject && (
                <ReviewRow
                  label="Progresi më i madh"
                  value={`${review.bestSubject.name} ${review.bestSubject.delta >= 0 ? "+" : ""}${review.bestSubject.delta}%`}
                />
              )}
              {review.worstSubject && (
                <ReviewRow
                  label="Kërkon fokus"
                  value={`${review.worstSubject.name} · ${review.worstSubject.progress}%`}
                />
              )}
            </div>

            <p className="mt-4 border-t border-ai/20 pt-3.5 text-[13px] leading-relaxed text-ink">
              {review.message}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="warn">{review.nextWeek.deadlines} afate javën tjetër</Badge>
              <Badge tone="bad">{review.nextWeek.exams} provim</Badge>
            </div>

            <Button
              variant="primary"
              className="mt-4 w-full"
              onClick={() => {
                dispatch({ type: "plan/generate", from: weekStart(addDays(today, 7)) });
                toast("Plani i javës tjetër u gjenerua.");
              }}
            >
              Gjenero javën tjetër
            </Button>
          </Card>

          <Card>
            <p className="text-[13px] font-medium text-ink">Totali i semestrit</p>
            <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
              {state.subjects.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <SubjectDot toneIndex={s.tone} size={7} />
                    <span className="truncate text-muted">{s.name}</span>
                  </span>
                  <span className="num shrink-0 font-medium text-ink">
                    {dur(minutesStudied(state, s.id))}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="num font-semibold text-ink">{value}</span>
    </div>
  );
}

function SubjectMeter({ subjectId }: { subjectId: string }) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const c = useTone(subject.tone);
  const p = subjectProgress(subject);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <SubjectDot toneIndex={subject.tone} />
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{subject.name}</span>
      <span className="num hidden text-[12px] text-faint sm:block">
        {topicsDone(subject)}/{subject.topics.length}
      </span>
      <div className="w-28 sm:w-44">
        <Progress value={p} height={6} color={c.fg} />
      </div>
      <span className="num w-9 text-right text-[13px] font-semibold text-ink">{p}%</span>
    </div>
  );
}

/**
 * Grade trend for one subject at a time — a single series keeps the reading
 * unambiguous and avoids decoding five lines by colour.
 */
function GradeTrend() {
  const { state } = useStore();
  const [subjectId, setSubjectId] = useState(state.subjects[0].id);
  const subject = state.subjects.find((s) => s.id === subjectId)!;
  const c = useTone(subject.tone);

  const data = useMemo(() => {
    const grades = state.grades
      .filter((g) => g.subjectId === subjectId)
      .sort((a, b) => a.date.localeCompare(b.date));
    return grades.reduce<
      { label: string; title: string; nota: number; mesatarja: number; weight: number; earned: number }[]
    >((rows, g) => {
      const prev = rows[rows.length - 1];
      const weight = (prev?.weight ?? 0) + g.weight;
      const earned = (prev?.earned ?? 0) + g.value * g.weight;
      rows.push({
        label: shortDate(g.date),
        title: g.title,
        nota: g.value,
        mesatarja: Math.round((earned / weight) * 10) / 10,
        weight,
        earned,
      });
      return rows;
    }, []);
  }, [state.grades, subjectId]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Ecuria e notës</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Mesatarja e ponderuar pas çdo vlerësimi — {subject.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {state.subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubjectId(s.id)}
              className={cx(
                "rounded-[7px] border px-2 py-1 text-[11.5px] font-medium transition-colors",
                s.id === subjectId
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:bg-sunken"
              )}
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="py-8 text-center text-[13px] text-muted">
          Duhen të paktën dy vlerësime për të parë ecurinë.
        </p>
      ) : (
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
              />
              <YAxis
                domain={[5, 10]}
                ticks={[5, 6, 7, 8, 9, 10]}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
                content={<ChartTooltip />}
              />
              <Line
                type="monotone"
                dataKey="mesatarja"
                stroke={c.fg}
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--surface)", stroke: c.fg, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: c.fg, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-muted">
        <TrendingUp size={13} style={{ color: c.fg }} />
        Mesatarja aktuale{" "}
        <span className="num font-semibold text-ink">{currentGrade(state, subjectId).toFixed(1)}</span>
        <span className="text-faint">· objektivi {subject.targetGrade}</span>
      </div>
    </Card>
  );
}

interface TooltipPayload {
  name?: string;
  value?: number | string;
  payload?: { title?: string; date?: string };
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-[9px] border border-line bg-raised px-2.5 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-[11.5px] text-muted">{row.payload?.title ?? label}</p>
      <p className="num mt-0.5 text-[13.5px] font-semibold text-ink">
        {row.value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}
