import type {
  AppState,
  Assignment,
  DayIndex,
  Exam,
  StudySession,
  Subject,
  Topic,
} from "./types";
import { addDays, addMinutes, dayIndex, daysBetween, dur, minutesOf } from "./date";

/* ============================================================
   Measurements — everything the planner and the UI reason about
   ============================================================ */

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Share of a subject's topics that are mastered, 0..100. */
export function subjectProgress(subject: Subject): number {
  if (!subject.topics.length) return 0;
  const got = subject.topics.reduce((s, t) => s + t.mastery, 0);
  return Math.round((got / (subject.topics.length * 3)) * 100);
}

export function topicsDone(subject: Subject): number {
  return subject.topics.filter((t) => t.mastery >= 2).length;
}

export function minutesStudied(state: AppState, subjectId: string, since?: string): number {
  return state.sessions
    .filter(
      (s) =>
        s.subjectId === subjectId &&
        s.status === "done" &&
        (!since || s.date >= since)
    )
    .reduce((sum, s) => sum + s.minutes, 0);
}

/**
 * Exam readiness blends what the student has mastered, how much time they have
 * actually put in, and how they are performing in the subject so far.
 *
 * When the student has actually sat quizzes in the subject, demonstrated
 * recall displaces some of the weight on self-reported mastery — marking a
 * topic "e zotëroj" is a claim, while answering questions about it is
 * evidence. A subject with no attempts keeps the original weighting exactly,
 * so a student who never quizzes is neither rewarded nor punished for it.
 */
export function examReadiness(state: AppState, exam: Exam): number {
  const subject = state.subjects.find((s) => s.id === exam.subjectId);
  if (!subject) return 0;
  const topics = subject.topics.filter((t) => exam.topicIds.includes(t.id));
  const mastery = topics.length
    ? topics.reduce((s, t) => s + t.mastery, 0) / (topics.length * 3)
    : 0;
  const targetMinutes = topics.length * 45;
  const time = clamp(exam.studiedMinutes / Math.max(1, targetMinutes));
  const grade = clamp(subject.currentGrade / 10);

  const recall = state.quizAccuracy?.[subject.id];
  if (recall == null) {
    return Math.round((mastery * 0.6 + time * 0.25 + grade * 0.15) * 100);
  }

  return Math.round(
    (mastery * 0.45 + time * 0.2 + grade * 0.1 + clamp(recall) * 0.25) * 100
  );
}

export function examTopicsDone(state: AppState, exam: Exam) {
  const subject = state.subjects.find((s) => s.id === exam.subjectId);
  const topics = subject?.topics.filter((t) => exam.topicIds.includes(t.id)) ?? [];
  return { done: topics.filter((t) => t.mastery >= 2).length, total: topics.length };
}

/** Weighted average of recorded grades; falls back to the stored current grade. */
export function currentGrade(state: AppState, subjectId: string): number {
  const gs = state.grades.filter((g) => g.subjectId === subjectId);
  if (!gs.length) {
    return state.subjects.find((s) => s.id === subjectId)?.currentGrade ?? 0;
  }
  const w = gs.reduce((s, g) => s + g.weight, 0);
  return Math.round((gs.reduce((s, g) => s + g.value * g.weight, 0) / w) * 10) / 10;
}

/**
 * What the student needs on the remaining assessments to land the target grade.
 * Returns null when the target is already secured or arithmetically out of reach.
 */
export function neededOnRemaining(state: AppState, subject: Subject) {
  const gs = state.grades.filter((g) => g.subjectId === subject.id);
  const doneWeight = gs.reduce((s, g) => s + g.weight, 0);
  const earned = gs.reduce((s, g) => s + g.value * g.weight, 0);
  const remaining = Math.max(0, 1 - doneWeight);
  if (remaining < 0.01) return null;
  const need = (subject.targetGrade - earned) / remaining;
  return {
    need: Math.round(need * 10) / 10,
    remainingWeight: Math.round(remaining * 100),
    reachable: need <= 10,
    secured: need <= 0,
  };
}

/* ============================================================
   Priority scoring
   ============================================================ */

export interface PriorityParts {
  examUrgency: number;
  assignmentUrgency: number;
  weakness: number;
  importance: number;
  goalWeight: number;
  recovery: number;
}

export interface Priority {
  subjectId: string;
  total: number;
  parts: PriorityParts;
  /** Human, Albanian explanation of why this subject ranks where it does. */
  reason: string;
  nextExam?: Exam;
  urgentAssignment?: Assignment;
}

export function nextExamFor(state: AppState, subjectId: string, today: string) {
  return state.exams
    .filter((e) => e.subjectId === subjectId && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function openAssignments(state: AppState, today: string) {
  return state.assignments
    .filter((a) => !a.done)
    .sort((a, b) => a.due.localeCompare(b.due) || b.progress - a.progress)
    .map((a) => ({ ...a, daysLeft: daysBetween(today, a.due) }));
}

export function priorityFor(state: AppState, subject: Subject, today: string): Priority {
  const exam = nextExamFor(state, subject.id, today);
  const progress = subjectProgress(subject) / 100;

  // Exams: closer + less ready ⇒ heavier.
  let examUrgency = 0;
  if (exam) {
    const days = Math.max(0, daysBetween(today, exam.date));
    const proximity = clamp(1 - days / 21);
    const gap = 1 - examReadiness(state, exam) / 100;
    examUrgency = proximity * gap * 40;
  }

  // Assignments: closer deadline + less finished ⇒ heavier.
  const assignments = state.assignments.filter((a) => !a.done && a.subjectId === subject.id);
  let assignmentUrgency = 0;
  let urgentAssignment: Assignment | undefined;
  for (const a of assignments) {
    const days = Math.max(0, daysBetween(today, a.due));
    const score = clamp(1 - days / 10) * (1 - a.progress / 100) * 35;
    if (score > assignmentUrgency) {
      assignmentUrgency = score;
      urgentAssignment = a;
    }
  }

  // Weakness: unmastered material, amplified by how hard the subject is.
  const weakness = (1 - progress) * (subject.difficulty / 5) * 25;

  const importance = (subject.importance / 5) * 10;

  // Goals steer the weighting the student asked for.
  let goalWeight = 0;
  if (state.goals.includes("kaloj-provimet") && exam) goalWeight += 6;
  if (state.goals.includes("permiresoj-notat")) {
    goalWeight += clamp((subject.targetGrade - currentGrade(state, subject.id)) / 3) * 10;
  }
  if (state.goals.includes("detyrat-me-kohe") && assignments.length) goalWeight += 5;
  if (state.goals.includes("afati") && exam) goalWeight += 4;

  // Missed sessions in the last week need making up.
  const weekAgo = addDays(today, -7);
  const missed = state.sessions.filter(
    (s) => s.subjectId === subject.id && s.status === "missed" && s.date >= weekAgo
  ).length;
  const recovery = missed * 8;

  const parts: PriorityParts = {
    examUrgency,
    assignmentUrgency,
    weakness,
    importance,
    goalWeight,
    recovery,
  };
  const total = Math.round(
    examUrgency + assignmentUrgency + weakness + importance + goalWeight + recovery
  );

  return {
    subjectId: subject.id,
    total,
    parts,
    reason: explain(state, subject, parts, exam, urgentAssignment, today, missed),
    nextExam: exam,
    urgentAssignment,
  };
}

function explain(
  state: AppState,
  subject: Subject,
  parts: PriorityParts,
  exam: Exam | undefined,
  assignment: Assignment | undefined,
  today: string,
  missed: number
): string {
  const bits: string[] = [];
  const top = Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0];

  if (top === "examUrgency" && exam) {
    const days = daysBetween(today, exam.date);
    bits.push(
      `Provimi është pas ${days} ditësh dhe gatishmëria është ${examReadiness(state, exam)}%.`
    );
  } else if (top === "assignmentUrgency" && assignment) {
    const days = daysBetween(today, assignment.due);
    bits.push(
      `“${assignment.title}” skadon ${days <= 0 ? "sot" : `pas ${days} ditësh`} dhe është ${assignment.progress}% e përfunduar.`
    );
  } else if (top === "weakness") {
    bits.push(
      `Ke mbuluar ${subjectProgress(subject)}% të temave dhe lënda është nga më të vështirat.`
    );
  } else if (top === "goalWeight") {
    bits.push(
      `Nota aktuale ${currentGrade(state, subject.id)} është nën objektivin ${subject.targetGrade}.`
    );
  } else {
    bits.push(`Lëndë me rëndësi të lartë për semestrin.`);
  }

  if (missed > 0) {
    bits.push(`${missed} sesion${missed > 1 ? "e" : ""} i humbur javën e fundit — po e kompensojmë.`);
  }
  return bits.join(" ");
}

export function priorities(state: AppState, today: string): Priority[] {
  return state.subjects
    .map((s) => priorityFor(state, s, today))
    .sort((a, b) => b.total - a.total);
}

/* ============================================================
   Free-time model
   ============================================================ */

export interface Block {
  from: number; // minutes from midnight
  to: number;
}

export function classesOn(state: AppState, date: string) {
  const d = dayIndex(date);
  return state.classes
    .filter((c) => c.day === d)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export function classMinutesOn(state: AppState, date: string) {
  return classesOn(state, date).reduce(
    (s, c) => s + (minutesOf(c.end) - minutesOf(c.start)),
    0
  );
}

/** Availability windows for the day with lectures (and a 30-min buffer) removed. */
export function freeBlocks(state: AppState, date: string): Block[] {
  const d = dayIndex(date);
  if (state.availability.freeDays.includes(d)) return [];

  const windows = state.availability.windows
    .filter((w) => w.day === d)
    .map((w) => ({ from: minutesOf(w.from), to: minutesOf(w.to) }));

  const busy = classesOn(state, date).map((c) => ({
    from: minutesOf(c.start) - 15,
    to: minutesOf(c.end) + 30,
  }));

  let blocks = windows;
  for (const b of busy) {
    const next: Block[] = [];
    for (const w of blocks) {
      if (b.to <= w.from || b.from >= w.to) {
        next.push(w);
        continue;
      }
      if (b.from > w.from) next.push({ from: w.from, to: b.from });
      if (b.to < w.to) next.push({ from: b.to, to: w.to });
    }
    blocks = next;
  }
  return blocks.filter((b) => b.to - b.from >= 20);
}

/** Minutes of study the day can realistically hold, after a heavy class day. */
export function dailyBudget(state: AppState, date: string): number {
  const free = freeBlocks(state, date).reduce((s, b) => s + (b.to - b.from), 0);
  const classMins = classMinutesOn(state, date);
  let cap = state.availability.maxMinutesPerDay;
  if (classMins >= 270) cap = Math.round(cap * 0.6);
  else if (classMins >= 180) cap = Math.round(cap * 0.8);
  return Math.min(free, cap);
}

/* ============================================================
   Plan generation
   ============================================================ */

function weakestTopic(subject: Subject, used: Set<string>): Topic | undefined {
  return [...subject.topics]
    .filter((t) => !used.has(t.id))
    .sort((a, b) => a.mastery - b.mastery || a.minutes - b.minutes)[0];
}

let planCounter = 0;
const planId = () => `ps-${Date.now().toString(36)}-${++planCounter}`;

export interface GenerateOptions {
  /** Keep sessions already marked done/missed before this moment. */
  keepBefore?: string;
  days?: number;
}

/**
 * Builds the study plan for `days` starting at `from`.
 *
 * The shape of the plan is decided by explicit rules — free time, daily budget,
 * deadline proximity and the priority score — so it is reproducible and
 * explainable. The AI layer only personalises the wording on top of it.
 */
export function generatePlan(
  state: AppState,
  from: string,
  options: GenerateOptions = {}
): StudySession[] {
  const days = options.days ?? 7;
  const ranked = priorities(state, from);
  const out: StudySession[] = [];

  // Running weights — a subject that already got time today drops in the queue.
  const served: Record<string, number> = {};
  for (const p of ranked) served[p.subjectId] = 0;

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const blocks = freeBlocks(state, date);
    if (!blocks.length) continue;

    let budget = dailyBudget(state, date);
    if (budget < 25) continue;

    const usedTopics = new Set<string>();
    let lastSubject: string | null = null;
    const heavyDay = classMinutesOn(state, date) >= 240;

    for (const block of blocks) {
      let cursor = block.from;
      while (budget >= 25 && block.to - cursor >= 25) {
        const available = Math.min(block.to - cursor, budget);
        const length = Math.min(
          state.availability.sessionLength,
          Math.max(25, Math.floor(available / 5) * 5)
        );

        // Pick the highest-priority subject that did not just run.
        const candidates = ranked
          .map((p) => ({
            p,
            score: p.total - served[p.subjectId] * 14 - (p.subjectId === lastSubject ? 30 : 0),
          }))
          .sort((a, b) => b.score - a.score);
        const pick = candidates[0]?.p;
        if (!pick) break;

        const subject = state.subjects.find((s) => s.id === pick.subjectId)!;
        const daysToExam = pick.nextExam ? daysBetween(date, pick.nextExam.date) : 99;
        const assignment = pick.urgentAssignment;
        const daysToDue = assignment ? daysBetween(date, assignment.due) : 99;

        let kind: StudySession["kind"] = "mesim";
        let title = "";
        let objective = "";
        let why = "";
        let linkedId: string | undefined;

        if (assignment && daysToDue >= 0 && daysToDue <= 3 && assignment.progress < 100) {
          kind = "detyre";
          title = assignment.title;
          const nextStep = assignment.steps.find((s) => !s.done);
          objective = nextStep ? nextStep.label : "Finalizo dhe dorëzo";
          why =
            daysToDue === 0
              ? "Skadon sot — ky është slloti i fundit i lirë."
              : `Skadon pas ${daysToDue} ditësh dhe ka mbetur ${100 - assignment.progress}%.`;
          linkedId = assignment.id;
        } else if (pick.nextExam && daysToExam <= 10) {
          kind = "provim-prep";
          const t = weakestTopic(subject, usedTopics);
          title = t?.name ?? "Përsëritje e përgjithshme";
          if (t) usedTopics.add(t.id);
          objective =
            t && t.mastery === 0
              ? "Kuptoje konceptin nga e para"
              : "Përforco dhe zgjidh detyra praktike";
          why = `${daysToExam} ditë deri te provimi — kjo temë është më e dobëta.`;
        } else {
          const t = weakestTopic(subject, usedTopics);
          title = t?.name ?? "Përsëritje";
          if (t) usedTopics.add(t.id);
          kind = t && t.mastery >= 2 ? "perseritje" : "mesim";
          objective =
            t && t.mastery === 0
              ? "Njihu me konceptet bazë"
              : t && t.mastery === 1
                ? "Kaloje nga “pak” në “e kuptoj”"
                : "Përsëritje e shpejtë për ta mbajtur të freskët";
          why = pick.reason;
        }

        out.push({
          id: planId(),
          subjectId: subject.id,
          kind,
          title,
          objective,
          date,
          start: timeFrom(cursor),
          minutes: length,
          status: "planned",
          why,
          linkedId,
        });

        served[subject.id] += 1;
        lastSubject = subject.id;
        budget -= length;
        cursor += length;

        // A short break, unless the block or the budget is nearly spent.
        const brk = state.availability.breakLength;
        if (budget >= 25 && block.to - cursor >= 25 + brk) {
          out.push({
            id: planId(),
            subjectId: null,
            kind: "pushim",
            title: "Pushim",
            date,
            start: timeFrom(cursor),
            minutes: brk,
            status: "planned",
          });
          cursor += brk;
        }

        if (heavyDay && served[subject.id] >= 1 && budget < 60) break;
      }
    }
  }

  return out;
}

function timeFrom(mins: number) {
  return addMinutes("00:00", mins);
}

/* ============================================================
   Smart rescheduling
   ============================================================ */

/** The next free slot at or after `from` that can hold `minutes`. */
export function findSlot(
  state: AppState,
  from: string,
  minutes: number,
  ignoreIds: string[] = []
): { date: string; start: string } | null {
  for (let i = 0; i < 14; i++) {
    const date = addDays(from, i);
    const taken = state.sessions
      .filter((s) => s.date === date && s.status === "planned" && !ignoreIds.includes(s.id))
      .map((s) => ({
        from: minutesOf(s.start),
        to: minutesOf(s.start) + s.minutes,
      }));

    for (const block of freeBlocks(state, date)) {
      let cursor = block.from;
      while (block.to - cursor >= minutes) {
        const end = cursor + minutes;
        const clash = taken.some((t) => cursor < t.to && end > t.from);
        if (!clash) return { date, start: timeFrom(cursor) };
        const next = taken
          .filter((t) => t.to > cursor)
          .sort((a, b) => a.to - b.to)[0];
        cursor = next ? next.to : cursor + 15;
      }
    }
  }
  return null;
}

/** Moves every missed session before `today` into the next viable slot. */
export function rebalance(state: AppState, today: string): StudySession[] {
  const missed = state.sessions.filter((s) => s.status === "missed" && s.date < today);
  let sessions = [...state.sessions];
  for (const m of missed) {
    const slot = findSlot({ ...state, sessions }, today, m.minutes, [m.id]);
    if (!slot) continue;
    sessions = sessions.map((s) =>
      s.id === m.id
        ? {
            ...s,
            date: slot.date,
            start: slot.start,
            status: "planned" as const,
            why: "I rikthyer nga një sesion i humbur.",
          }
        : s
    );
  }
  return sessions;
}

/* ============================================================
   Day / week read models used across the UI
   ============================================================ */

export interface AgendaItem {
  id: string;
  type: "class" | "session" | "exam" | "assignment" | "group";
  start: string;
  end: string;
  minutes: number;
  title: string;
  subtitle?: string;
  subjectId: string | null;
  status?: StudySession["status"];
  session?: StudySession;
  kind?: string;
  room?: string;
}

export function agendaFor(state: AppState, date: string): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const c of classesOn(state, date)) {
    const subject = state.subjects.find((s) => s.id === c.subjectId);
    items.push({
      id: c.id,
      type: "class",
      start: c.start,
      end: c.end,
      minutes: minutesOf(c.end) - minutesOf(c.start),
      title: subject?.name ?? "Ligjëratë",
      subtitle: CLASS_LABEL[c.kind],
      subjectId: c.subjectId,
      kind: c.kind,
      room: c.room,
    });
  }

  for (const s of state.sessions.filter((x) => x.date === date)) {
    const subject = state.subjects.find((x) => x.id === s.subjectId);
    items.push({
      id: s.id,
      type: "session",
      start: s.start,
      end: addMinutes(s.start, s.minutes),
      minutes: s.minutes,
      title: s.kind === "pushim" ? "Pushim" : s.title,
      subtitle: s.kind === "pushim" ? undefined : subject?.name,
      subjectId: s.subjectId,
      status: s.status,
      session: s,
      kind: s.kind,
    });
  }

  for (const e of state.exams.filter((x) => x.date === date)) {
    const subject = state.subjects.find((s) => s.id === e.subjectId);
    items.push({
      id: e.id,
      type: "exam",
      start: e.start,
      end: addMinutes(e.start, 120),
      minutes: 120,
      title: `${subject?.name} — ${e.title}`,
      subtitle: "Provim",
      subjectId: e.subjectId,
      room: e.room,
    });
  }

  for (const a of state.assignments.filter((x) => x.due === date && !x.done)) {
    const subject = state.subjects.find((s) => s.id === a.subjectId);
    items.push({
      id: a.id,
      type: "assignment",
      start: "23:59",
      end: "23:59",
      minutes: 0,
      title: `Afati: ${a.title}`,
      subtitle: subject?.name,
      subjectId: a.subjectId,
    });
  }

  for (const g of state.groups) {
    if (g.nextSession?.date === date) {
      items.push({
        id: `grp-${g.id}`,
        type: "group",
        start: g.nextSession.start,
        end: addMinutes(g.nextSession.start, g.nextSession.minutes),
        minutes: g.nextSession.minutes,
        title: g.name,
        subtitle: g.nextSession.topic,
        subjectId: g.subjectId,
      });
    }
  }

  return items.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export const CLASS_LABEL: Record<string, string> = {
  ligjerate: "Ligjëratë",
  ushtrime: "Ushtrime",
  lab: "Laborator",
  seminar: "Seminar",
};

export const SESSION_LABEL: Record<string, string> = {
  mesim: "Mësim",
  perseritje: "Përsëritje",
  detyre: "Detyrë",
  pushim: "Pushim",
  grup: "Grup",
  "provim-prep": "Përgatitje provimi",
};

export function dayProgress(state: AppState, date: string) {
  const items = agendaFor(state, date).filter(
    (i) => i.type === "session" && i.kind !== "pushim"
  );
  const classes = agendaFor(state, date).filter((i) => i.type === "class");
  const done = items.filter((i) => i.status === "done").length;
  const total = items.length;
  return {
    done,
    total,
    classes: classes.length,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

export function weekStats(state: AppState, weekStartDate: string) {
  const end = addDays(weekStartDate, 6);
  const inWeek = state.sessions.filter(
    (s) => s.date >= weekStartDate && s.date <= end && s.kind !== "pushim"
  );
  const done = inWeek.filter((s) => s.status === "done");
  const minutes = done.reduce((sum, s) => sum + s.minutes, 0);
  const planned = inWeek.length;
  return {
    minutes,
    label: dur(minutes),
    done: done.length,
    planned,
    missed: inWeek.filter((s) => s.status === "missed").length,
    consistency: planned ? Math.round((done.length / planned) * 100) : 0,
  };
}

export function dayOfWeekName(date: string): DayIndex {
  return dayIndex(date);
}
