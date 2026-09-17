"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Flame,
  GraduationCap,
  ListTodo,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  dur,
  greeting,
  longDate,
  minutesOf,
  relativeDays,
  weekStart,
} from "@/lib/date";
import {
  agendaFor,
  dayProgress,
  examReadiness,
  openAssignments,
  weekStats,
} from "@/lib/planner";
import { daySummary, focusHint } from "@/lib/insights";
import {
  Badge,
  Button,
  Card,
  Progress,
  Ring,
  SectionTitle,
  cx,
  useTone,
  useToast,
} from "@/components/ui";
import { AgendaRow } from "@/components/app/session-row";

export default function TodayPage() {
  const { state, dispatch, today, now } = useStore();
  const toast = useToast();
  const [asked, setAsked] = useState<string | null>(null);

  const agenda = agendaFor(state, today);
  const progress = dayProgress(state, today);
  const briefing = daySummary(state, today);
  const insight = focusHint(state, today);
  const ws = weekStats(state, weekStart(today));

  const current = agenda.find(
    (i) => minutesOf(i.start) <= minutesOf(now) && minutesOf(i.end) > minutesOf(now)
  );
  const next = agenda.find(
    (i) => minutesOf(i.start) > minutesOf(now) && i.status !== "done" && i.kind !== "pushim"
  );

  const missed = useMemo(
    () =>
      state.sessions.filter(
        (s) =>
          s.status === "planned" &&
          s.kind !== "pushim" &&
          (s.date < today || (s.date === today && minutesOf(s.start) + s.minutes < minutesOf(now)))
      ),
    [state.sessions, today, now]
  );

  const upcoming = [
    ...openAssignments(state, today)
      .filter((a) => a.daysLeft >= 0 && a.daysLeft <= 14)
      .slice(0, 2)
      .map((a) => ({
        id: a.id,
        kind: "detyre" as const,
        title: a.title,
        subject: state.subjects.find((s) => s.id === a.subjectId),
        when: a.due,
        meta: `${a.progress}%`,
        href: "/detyrat",
      })),
    ...state.exams
      .filter((e) => e.date >= today)
      .slice(0, 2)
      .map((e) => ({
        id: e.id,
        kind: "provim" as const,
        title: `Provimi ${state.subjects.find((s) => s.id === e.subjectId)?.name}`,
        subject: state.subjects.find((s) => s.id === e.subjectId),
        when: e.date,
        meta: `${examReadiness(state, e)}%`,
        href: "/provimet",
      })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 4);

  const group = state.groups.find((g) => g.nextSession?.date === today);
  const isNew = state.subjects.length === 0;

  return (
    <div className="flex flex-col gap-7">
      {/* ── Greeting ───────────────────────────────────── */}
      <header className="anim-in">
        <p className="text-[13px] text-muted">{longDate(today)}</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
          {greeting(now)}, {state.profile.name}.
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">{briefing}</p>
      </header>

      {isNew && (
        <Card className="anim-in border-brand/30 bg-brand-soft/40">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand text-white">
              <Sparkles size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink">Le ta ndërtojmë orarin tënd</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                Ende nuk ke lëndë. Shto lëndët dhe orarin, pastaj AI e ndërton planin e javës për
                ty.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/onboarding">
                  <Button variant="primary" size="sm">
                    Konfiguro llogarinë
                  </Button>
                </Link>
                <Link href="/lendet">
                  <Button size="sm">Shto lëndë</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Now / Next ─────────────────────────────────── */}
      <div className="anim-in anim-delay-1 grid gap-3 sm:grid-cols-2">
        <NowCard item={current} label="Tani" empty="Asgjë në këtë moment" />
        <NowCard item={next} label="Vijon" empty="Dita është e mbyllur" />
      </div>

      {/* ── Missed sessions — smart rescheduling ───────── */}
      {missed.length > 0 && (
        <Card className="anim-in border-warn/30 bg-warn-soft/50">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
              <CalendarClock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">
                {missed.length === 1
                  ? `Nuk e përfundove sesionin e ${state.subjects.find((s) => s.id === missed[0].subjectId)?.name ?? "planifikuar"}.`
                  : `${missed.length} sesione mbetën pa u përfunduar.`}{" "}
                Ta zhvendosim?
              </p>
              <p className="mt-1 text-[13px] text-muted">
                I rishpërndaj në sllotet e para të lira dhe e ribalancoj pjesën tjetër të javës.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    missed.forEach((m) =>
                      dispatch({ type: "session/status", id: m.id, status: "missed" })
                    );
                    dispatch({ type: "plan/rebalance", today });
                    toast("Java u ribalancua.");
                  }}
                >
                  Riplanifiko automatikisht
                </Button>
                <Link href="/plani">
                  <Button size="sm">Zgjedh vetë kohën</Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    missed.forEach((m) =>
                      dispatch({ type: "session/status", id: m.id, status: "skipped" })
                    );
                    toast("Në rregull — i anulova.");
                  }}
                >
                  Anulo
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Today's agenda + side rail ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="anim-in anim-delay-2 min-w-0">
          <SectionTitle
            sub={`${progress.classes} ligjërata · ${progress.total} sesione mësimi`}
            action={
              <Link href="/plani">
                <Button size="sm" variant="ghost">
                  Plani i javës
                  <ArrowRight size={13} />
                </Button>
              </Link>
            }
          >
            Çka po mësojmë sot?
          </SectionTitle>

          {agenda.length === 0 ? (
            <Card className="text-center">
              <p className="text-[14px] text-muted">
                {isNew
                  ? "Sapo të shtosh lëndët dhe orarin, dita jote do të shfaqet këtu."
                  : "Sot nuk ke asgjë të planifikuar."}
              </p>
              {!isNew && (
                <Link href="/plani" className="mt-3 inline-block">
                  <Button variant="primary" size="sm">
                    <Sparkles size={13} />
                    Gjenero planin
                  </Button>
                </Link>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {agenda.map((item) => (
                <AgendaRow key={item.id} item={item} now={now} onAsk={(q) => setAsked(q)} />
              ))}
            </div>
          )}

          {asked && (
            <Card className="anim-in mt-3 border-ai/30 bg-ai-soft/40">
              <div className="flex gap-3">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-ai" />
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{asked}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Hape Asistentin për ta vazhduar bisedën me kontekstin e plotë.
                  </p>
                  <Link href="/ai" className="mt-2.5 inline-block">
                    <Button size="sm" variant="ai">
                      Hap Asistentin
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </section>

        <aside className="anim-in anim-delay-3 flex flex-col gap-4">
          {/* Daily progress */}
          <Card>
            <div className="flex items-center gap-4">
              <Ring value={progress.percent} size={72} stroke={7}>
                <span className="num text-[17px] font-semibold text-ink">{progress.percent}%</span>
              </Ring>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">Progresi i ditës</p>
                <p className="num mt-0.5 text-[13px] text-muted">
                  {progress.done} / {progress.total} aktivitete
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
                  <Flame size={12} />
                  Seri {state.streak} ditë
                </p>
              </div>
            </div>
          </Card>

          {/* Where attention should go — computed from the student's own rows */}
          {insight && (
            <Card>
              <div className="flex items-center gap-2 text-muted">
                <Target size={14} />
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
                  Fokusi
                </span>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{insight}</p>
              <Link href="/ai" className="mt-3 inline-block">
                <Button size="sm" variant="ai">
                  <Sparkles size={13} />
                  Pyet Asistentin
                </Button>
              </Link>
            </Card>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
          <Card padded={false}>
            <div className="px-5 pb-3 pt-4">
              <p className="text-[13px] font-medium text-ink">Vijon së shpejti</p>
            </div>
            <div className="divide-y divide-line">
              {upcoming.map((u) => (
                <Link
                  key={u.id}
                  href={u.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken"
                >
                  <span
                    className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      u.kind === "provim" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"
                    )}
                  >
                    {u.kind === "provim" ? <GraduationCap size={14} /> : <ListTodo size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {u.title}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {relativeDays(today, u.when)} · {u.subject?.name}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[12.5px] text-faint">{u.meta}</span>
                </Link>
              ))}
            </div>
          </Card>
          )}

          {/* Group session tonight */}
          {group && group.nextSession && (
            <Card className="border-brand/30">
              <div className="flex items-center gap-2 text-brand">
                <Users size={14} />
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em]">
                  Sonte në grup
                </span>
              </div>
              <p className="mt-2 text-[14px] font-medium text-ink">{group.name}</p>
              <p className="num mt-0.5 text-[12.5px] text-muted">
                {group.nextSession.start} · {group.nextSession.topic}
              </p>
              <Link href={`/mso-bashke/${group.id}`} className="mt-3 inline-block">
                <Button size="sm" variant="primary">
                  Hyr në dhomë
                </Button>
              </Link>
            </Card>
          )}

          {/* Week at a glance */}
          <Card>
            <p className="text-[13px] font-medium text-ink">Kjo javë</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="num text-[20px] font-semibold leading-none text-ink">{ws.label}</p>
                <p className="mt-1 text-[12px] text-muted">mësim</p>
              </div>
              <div className="text-right">
                <p className="num text-[20px] font-semibold leading-none text-ink">
                  {ws.done}/{ws.planned}
                </p>
                <p className="mt-1 text-[12px] text-muted">sesione</p>
              </div>
            </div>
            <Progress value={ws.consistency} className="mt-3.5" />
            <p className="mt-2 text-[12px] text-faint">Konsistenca {ws.consistency}%</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function NowCard({
  item,
  label,
  empty,
}: {
  item: ReturnType<typeof agendaFor>[number] | undefined;
  label: string;
  empty: string;
}) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === item?.subjectId);
  const c = useTone(subject?.tone ?? 0);
  const isNow = label === "Tani";

  if (!item) {
    return (
      <Card className="flex min-h-[104px] flex-col justify-center border-dashed">
        <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">{label}</p>
        <p className="mt-1.5 text-[14px] text-muted">{empty}</p>
      </Card>
    );
  }

  return (
    <Card
      className={cx(
        "min-h-[104px] transition-shadow",
        isNow && "border-brand/40 shadow-[var(--shadow-sm)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "text-[12px] font-semibold uppercase tracking-[0.05em]",
            isNow ? "text-brand" : "text-faint"
          )}
        >
          {label}
        </span>
        <span className="num text-[12.5px] text-muted">
          {item.start}
          {item.minutes > 0 && ` – ${item.end}`}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="h-7 w-[3px] rounded-full" style={{ background: c.fg }} />
        <div className="min-w-0">
          <p className="truncate text-[15.5px] font-medium text-ink">{item.title}</p>
          <p className="truncate text-[12.5px] text-muted">
            {item.subtitle ?? subject?.name}
            {item.minutes > 0 && item.type === "session" && ` · ${dur(item.minutes)}`}
          </p>
        </div>
      </div>
      {item.type === "session" && item.kind !== "pushim" && (
        <Link href={`/mesim/${item.id}`} className="mt-3 inline-block">
          <Button size="sm" variant={isNow ? "primary" : "secondary"}>
            Fillo sesionin
          </Button>
        </Link>
      )}
      {item.type === "class" && item.room && (
        <Badge className="mt-3">{item.room}</Badge>
      )}
    </Card>
  );
}
