import "server-only";
import { db } from "@/lib/db";
import { addDays, dayIndex, daysBetween, dur, longDate, minutesOf } from "@/lib/date";

/**
 * The student context sent to the model.
 *
 * Deliberately *not* a dump of the database: only the rows that bear on the
 * question, summarised, with the derived numbers already computed. Arithmetic
 * (readiness, averages, remaining minutes) is done here in code — the model is
 * asked to reason and explain, never to add up.
 */
export interface StudentContext {
  currentDate: string;
  name: string;
  subjects: {
    id: string;
    name: string;
    difficulty: number;
    importance: number;
    targetGrade: number;
    currentGrade: number;
    progress: number;
    weakTopics: string[];
    unknownTopics: string[];
  }[];
  todaySchedule: { time: string; label: string; kind: string }[];
  weekSchedule: { day: string; entries: string[] }[];
  upcomingAssignments: {
    id: string;
    title: string;
    subject: string;
    due: string;
    daysLeft: number;
    progress: number;
    remainingMinutes: number;
  }[];
  upcomingExams: {
    id: string;
    subject: string;
    title: string;
    date: string;
    daysLeft: number;
    readiness: number;
    topicsDone: number;
    topicsTotal: number;
  }[];
  recentProgress: {
    minutesThisWeek: number;
    sessionsDone: number;
    sessionsPlanned: number;
    missedRecently: number;
    streak: number;
  };
  goals: string[];
  availability: {
    windows: { day: string; from: string; to: string }[];
    sessionLength: number;
    breakLength: number;
    maxMinutesPerDay: number;
    freeDays: string[];
  };
}

const DAY_NAMES = [
  "E hënë",
  "E martë",
  "E mërkurë",
  "E enjte",
  "E premte",
  "E shtunë",
  "E diel",
];

const CLASS_LABELS: Record<string, string> = {
  ligjerate: "Ligjëratë",
  ushtrime: "Ushtrime",
  lab: "Laborator",
  seminar: "Seminar",
};

export async function buildStudentContext(
  userId: string,
  today: string
): Promise<StudentContext> {
  const weekAgo = addDays(today, -7);
  const horizon = addDays(today, 30);

  const [user, subjects, lectures, assignments, exams, sessions, goals, availability, pref] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
      db.subject.findMany({
        where: { userId },
        include: { topics: { orderBy: { position: "asc" } } },
      }),
      db.lecture.findMany({ where: { userId } }),
      db.assignment.findMany({ where: { userId, done: false }, orderBy: { due: "asc" } }),
      db.exam.findMany({
        where: { userId, date: { gte: today, lte: horizon } },
        include: { topics: true },
        orderBy: { date: "asc" },
      }),
      db.studySession.findMany({ where: { userId, date: { gte: weekAgo } } }),
      db.studyGoal.findMany({ where: { userId } }),
      db.availability.findMany({ where: { userId } }),
      db.studyPreference.findUnique({ where: { userId } }),
    ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const todayIdx = dayIndex(today);
  const todaySchedule = lectures
    .filter((l) => l.day === todayIdx)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
    .map((l) => ({
      time: `${l.start}–${l.end}`,
      label: subjectById.get(l.subjectId)?.name ?? "Ligjëratë",
      kind: CLASS_LABELS[l.kind] ?? l.kind,
    }));

  const weekSchedule = DAY_NAMES.slice(0, 7).map((day, i) => ({
    day,
    entries: lectures
      .filter((l) => l.day === i)
      .sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
      .map(
        (l) =>
          `${l.start}–${l.end} ${subjectById.get(l.subjectId)?.name ?? ""} (${CLASS_LABELS[l.kind] ?? l.kind})`
      ),
  })).filter((d) => d.entries.length > 0);

  const done = sessions.filter((s) => s.status === "done");

  return {
    currentDate: `${longDate(today)} (${today})`,
    name: user.name,

    subjects: subjects.map((s) => {
      const total = s.topics.length || 1;
      const mastered = s.topics.reduce((sum, t) => sum + t.mastery, 0);
      return {
        id: s.id,
        name: s.name,
        difficulty: s.difficulty,
        importance: s.importance,
        targetGrade: s.targetGrade,
        currentGrade: s.currentGrade,
        progress: Math.round((mastered / (total * 3)) * 100),
        weakTopics: s.topics.filter((t) => t.mastery === 1).map((t) => t.name),
        unknownTopics: s.topics.filter((t) => t.mastery === 0).map((t) => t.name),
      };
    }),

    todaySchedule,
    weekSchedule,

    upcomingAssignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      subject: subjectById.get(a.subjectId)?.name ?? "",
      due: a.due,
      daysLeft: daysBetween(today, a.due),
      progress: a.progress,
      remainingMinutes: Math.round((a.estMinutes * (100 - a.progress)) / 100),
    })),

    upcomingExams: exams.map((e) => {
      const subject = subjectById.get(e.subjectId);
      const ids = new Set(e.topics.map((t) => t.topicId));
      const topics = (subject?.topics ?? []).filter((t) => ids.has(t.id));
      const total = topics.length || 1;
      const mastery = topics.reduce((sum, t) => sum + t.mastery, 0) / (total * 3);
      const time = Math.min(1, e.studiedMinutes / Math.max(1, topics.length * 45));
      const grade = Math.min(1, (subject?.currentGrade ?? 0) / 10);
      return {
        id: e.id,
        subject: subject?.name ?? "",
        title: e.title,
        date: e.date,
        daysLeft: daysBetween(today, e.date),
        readiness: Math.round((mastery * 0.6 + time * 0.25 + grade * 0.15) * 100),
        topicsDone: topics.filter((t) => t.mastery >= 2).length,
        topicsTotal: topics.length,
      };
    }),

    recentProgress: {
      minutesThisWeek: done.reduce((sum, s) => sum + s.minutes, 0),
      sessionsDone: done.length,
      sessionsPlanned: sessions.filter((s) => s.kind !== "pushim").length,
      missedRecently: sessions.filter((s) => s.status === "missed").length,
      streak: 0,
    },

    goals: goals.map((g) => g.key),

    availability: {
      windows: availability.map((a) => ({
        day: DAY_NAMES[a.day] ?? String(a.day),
        from: a.fromTime,
        to: a.toTime,
      })),
      sessionLength: pref?.sessionLength ?? 45,
      breakLength: pref?.breakLength ?? 15,
      maxMinutesPerDay: pref?.maxMinutesPerDay ?? 180,
      freeDays: (pref?.freeDays ?? "")
        .split(",")
        .map((d) => DAY_NAMES[Number(d)])
        .filter(Boolean),
    },
  };
}

/** A compact prose rendering — cheaper in tokens than raw JSON. */
export function renderContext(ctx: StudentContext): string {
  const lines: string[] = [];
  lines.push(`Studenti: ${ctx.name}. Sot është ${ctx.currentDate}.`);

  lines.push("\nLËNDËT:");
  for (const s of ctx.subjects) {
    lines.push(
      `- [${s.id}] ${s.name}: progres ${s.progress}%, nota ${s.currentGrade}/${s.targetGrade}, vështirësia ${s.difficulty}/5, rëndësia ${s.importance}/5`
    );
    if (s.unknownTopics.length) lines.push(`    Nuk i di: ${s.unknownTopics.join(", ")}`);
    if (s.weakTopics.length) lines.push(`    I di pak: ${s.weakTopics.join(", ")}`);
  }

  if (ctx.todaySchedule.length) {
    lines.push("\nORARI I SOTËM:");
    for (const c of ctx.todaySchedule) lines.push(`- ${c.time} ${c.label} (${c.kind})`);
  } else {
    lines.push("\nORARI I SOTËM: pa ligjërata.");
  }

  if (ctx.weekSchedule.length) {
    lines.push("\nORARI JAVOR:");
    for (const d of ctx.weekSchedule) lines.push(`- ${d.day}: ${d.entries.join("; ")}`);
  }

  if (ctx.upcomingExams.length) {
    lines.push("\nPROVIMET:");
    for (const e of ctx.upcomingExams) {
      lines.push(
        `- ${e.subject} — ${e.title}, ${e.date} (pas ${e.daysLeft} ditësh), gatishmëria ${e.readiness}%, tema ${e.topicsDone}/${e.topicsTotal}`
      );
    }
  }

  if (ctx.upcomingAssignments.length) {
    lines.push("\nDETYRAT E HAPURA:");
    for (const a of ctx.upcomingAssignments) {
      lines.push(
        `- ${a.title} (${a.subject}), afati ${a.due} — ${a.daysLeft} ditë, ${a.progress}% e bërë, mbeten ~${dur(a.remainingMinutes)}`
      );
    }
  }

  lines.push("\nKOHA E LIRË PËR MËSIM:");
  for (const w of ctx.availability.windows) lines.push(`- ${w.day}: ${w.from}–${w.to}`);
  lines.push(
    `Sesion i preferuar ${ctx.availability.sessionLength} min, pushim ${ctx.availability.breakLength} min, maksimumi ${ctx.availability.maxMinutesPerDay} min/ditë.`
  );
  if (ctx.availability.freeDays.length) {
    lines.push(`Ditë pushimi: ${ctx.availability.freeDays.join(", ")}.`);
  }

  const p = ctx.recentProgress;
  lines.push(
    `\nJAVA E FUNDIT: ${dur(p.minutesThisWeek)} mësim, ${p.sessionsDone}/${p.sessionsPlanned} sesione të përfunduara, ${p.missedRecently} të humbura.`
  );

  if (ctx.goals.length) lines.push(`OBJEKTIVAT: ${ctx.goals.join(", ")}.`);

  return lines.join("\n");
}
