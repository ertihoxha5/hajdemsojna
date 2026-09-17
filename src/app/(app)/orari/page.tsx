"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  DAYS_LONG,
  DAYS_SHORT,
  MONTHS,
  addDays,
  dur,
  longDate,
  minutesOf,
  parseISO,
  weekStart,
} from "@/lib/date";
import { CLASS_LABEL, agendaFor, classMinutesOn } from "@/lib/planner";
import {
  Button,
  Card,
  IconButton,
  PageHeader,
  Segmented,
  SubjectDot,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import { AgendaRow } from "@/components/app/session-row";
import { WeekGrid } from "@/components/app/week-grid";

type View = "dite" | "jave" | "muaj" | "orari";

export default function SchedulePage() {
  const { today, now } = useStore();
  const [view, setView] = useState<View>("jave");
  const [offset, setOffset] = useState(0);

  const anchor = addDays(today, offset * (view === "muaj" ? 30 : view === "dite" ? 1 : 7));
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const title =
    view === "dite"
      ? longDate(anchor)
      : view === "muaj"
        ? `${MONTHS[parseISO(anchor).getMonth()]} ${parseISO(anchor).getFullYear()}`
        : `${parseISO(start).getDate()} – ${parseISO(addDays(start, 6)).getDate()} ${MONTHS[parseISO(addDays(start, 6)).getMonth()]}`;

  return (
    <div>
      <PageHeader
        title="Orari"
        question="Kur kam kohë?"
        right={
          <>
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v as View);
                setOffset(0);
              }}
              options={[
                { key: "dite", label: "Sot" },
                { key: "jave", label: "Javë" },
                { key: "muaj", label: "Muaj" },
                { key: "orari", label: "Ligjëratat" },
              ]}
            />
          </>
        }
      />

      {view !== "orari" && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton label="Para" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton label="Pas" onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight size={16} />
            </IconButton>
            <span className="ml-2 text-[14.5px] font-medium text-ink">{title}</span>
          </div>
          {offset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
              Kthehu te sot
            </Button>
          )}
        </div>
      )}

      {view === "jave" && (
        <>
          <WeekGrid days={days} />
          <Legend />
        </>
      )}

      {view === "dite" && <DayView date={anchor} now={now} />}

      {view === "muaj" && <MonthView anchor={anchor} />}

      {view === "orari" && <TimetableEditor />}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-sunken shadow-[inset_2px_0_0_var(--muted)]" />
        Ligjëratë
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-brand bg-brand-soft" />
        Sesion mësimi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]" />
        Grup
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-bad-soft shadow-[inset_2px_0_0_var(--bad)]" />
        Provim
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-warn bg-warn-soft" />
        Afat detyre
      </span>
      <span className="ml-auto text-faint">Tërhiqi blloqet për t&apos;i zhvendosur.</span>
    </div>
  );
}

function DayView({ date, now }: { date: string; now: string }) {
  const { state } = useStore();
  const items = agendaFor(state, date);
  const classMins = classMinutesOn(state, date);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <Card className="text-center text-[14px] text-muted">
            Kjo ditë është bosh. Kohë e mirë për pushim ose për të zënë diçka të mbetur.
          </Card>
        ) : (
          items.map((i) => <AgendaRow key={i.id} item={i} now={now} />)
        )}
      </div>
      <Card className="h-fit">
        <p className="text-[13px] font-medium text-ink">Ngarkesa e ditës</p>
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <Row label="Ligjërata" value={dur(classMins)} />
          <Row
            label="Mësim i planifikuar"
            value={dur(
              items
                .filter((i) => i.type === "session" && i.kind !== "pushim")
                .reduce((s, i) => s + i.minutes, 0)
            )}
          />
          <Row
            label="Kohë e lirë"
            value={dur(Math.max(0, 14 * 60 - classMins))}
          />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  );
}

function MonthView({ anchor }: { anchor: string }) {
  const { state, today } = useStore();
  const d = parseISO(anchor);
  const first = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-01`;
  const gridStart = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = d.getMonth();

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {DAYS_SHORT.map((x) => (
          <div
            key={x}
            className="px-2 py-2 text-center text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint"
          >
            {x}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const items = agendaFor(state, date);
          const inMonth = parseISO(date).getMonth() === month;
          const isToday = date === today;
          return (
            <div
              key={date}
              className={cx(
                "min-h-[92px] border-b border-l border-line p-1.5 first:border-l-0",
                !inMonth && "bg-sunken/40"
              )}
            >
              <div
                className={cx(
                  "num mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11.5px]",
                  isToday
                    ? "bg-brand font-semibold text-white"
                    : inMonth
                      ? "text-ink"
                      : "text-faint"
                )}
              >
                {parseISO(date).getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((i) => (
                  <MonthChip key={i.id} item={i} />
                ))}
                {items.length > 3 && (
                  <span className="num pl-0.5 text-[10.5px] text-faint">
                    +{items.length - 3} të tjera
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({ item }: { item: ReturnType<typeof agendaFor>[number] }) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === item.subjectId);
  const c = useTone(subject?.tone ?? 0);
  if (item.kind === "pushim") return null;

  const color =
    item.type === "exam" ? "var(--bad)" : item.type === "assignment" ? "var(--warn)" : c.fg;

  return (
    <span className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-muted">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{item.title}</span>
    </span>
  );
}

/* ============================================================
   Timetable editor — the recurring weekly schedule
   ============================================================ */

function TimetableEditor() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState<number | null>(null);
  const [form, setForm] = useState({
    subjectId: state.subjects[0]?.id ?? "",
    start: "08:00",
    end: "09:30",
    kind: "ligjerate",
    room: "",
  });

  return (
    <div>
      <p className="mb-4 text-[13.5px] text-muted">
        Orari javor i ligjëratave. Ndryshimet këtu ndikojnë menjëherë te koha e lirë dhe te plani i
        mësimit.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DAYS_LONG.slice(0, 6).map((day, i) => {
          const entries = state.classes
            .filter((c) => c.day === i)
            .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
          return (
            <Card key={day} padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="text-[13.5px] font-semibold text-ink">{day}</span>
                <IconButton label="Shto" onClick={() => setAdding(adding === i ? null : i)}>
                  <Plus size={15} />
                </IconButton>
              </div>

              <div className="divide-y divide-line">
                {entries.length === 0 && (
                  <p className="px-4 py-5 text-center text-[12.5px] text-faint">Ditë e lirë</p>
                )}
                {entries.map((c) => {
                  const subject = state.subjects.find((s) => s.id === c.subjectId);
                  return (
                    <div key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <span className="num w-[86px] shrink-0 text-[12px] text-muted">
                        {c.start}–{c.end}
                      </span>
                      <SubjectDot toneIndex={subject?.tone ?? 0} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {subject?.name}
                        </span>
                        <span className="block text-[11.5px] text-faint">
                          {CLASS_LABEL[c.kind]} · {c.room}
                        </span>
                      </span>
                      <IconButton
                        label="Fshij"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          dispatch({ type: "class/remove", id: c.id });
                          toast("Ligjërata u hoq.");
                        }}
                      >
                        <Trash size={14} />
                      </IconButton>
                    </div>
                  );
                })}
              </div>

              {adding === i && (
                <div className="anim-fade flex flex-col gap-2 border-t border-line bg-sunken/50 p-3">
                  <select
                    value={form.subjectId}
                    onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink"
                  >
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })}
                      className="num flex-1 rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink"
                    />
                    <input
                      type="time"
                      value={form.end}
                      onChange={(e) => setForm({ ...form, end: e.target.value })}
                      className="num flex-1 rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value })}
                      className="flex-1 rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink"
                    >
                      <option value="ligjerate">Ligjëratë</option>
                      <option value="ushtrime">Ushtrime</option>
                      <option value="lab">Laborator</option>
                      <option value="seminar">Seminar</option>
                    </select>
                    <input
                      placeholder="Salla"
                      value={form.room}
                      onChange={(e) => setForm({ ...form, room: e.target.value })}
                      className="w-24 rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      dispatch({
                        type: "class/add",
                        entry: {
                          id: `c-${Date.now().toString(36)}`,
                          subjectId: form.subjectId,
                          day: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                          start: form.start,
                          end: form.end,
                          kind: form.kind as "ligjerate",
                          room: form.room || "—",
                        },
                      });
                      setAdding(null);
                      toast("Ligjërata u shtua.");
                    }}
                  >
                    Shto në orar
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-medium text-ink">Importo orarin</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Lidh kalendarin e fakultetit (ICS) dhe ligjëratat përditësohen vetë.
            </p>
          </div>
          <Button size="sm" onClick={() => toast("Importimi i kalendarit vjen së shpejti.")}>
            Lidh kalendarin
          </Button>
        </div>
      </Card>
    </div>
  );
}
