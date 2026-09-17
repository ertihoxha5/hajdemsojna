import type { AppState } from "./types";
import { addDays, dur, relativeDays, weekStart } from "./date";
import {
  agendaFor,
  examReadiness,
  minutesStudied,
  priorities,
  subjectProgress,
  weekStats,
} from "./planner";

/**
 * Computed summaries of the student's own data.
 *
 * These are deterministic — arithmetic over rows, not model output — so they
 * are instant, free, and identical every time. The UI labels them as such;
 * anything presented as coming from the assistant goes through the real model
 * instead (see src/lib/ai).
 */

/** "Sot është ditë e ngarkuar. Ke 2 ligjërata dhe 3 sesione." */
export function daySummary(state: AppState, today: string): string {
  const agenda = agendaFor(state, today);
  const classes = agenda.filter((i) => i.type === "class");
  const sessions = agenda.filter((i) => i.type === "session" && i.kind !== "pushim");
  const studyMinutes = sessions.reduce((s, i) => s + i.minutes, 0);
  const classMinutes = classes.reduce((s, i) => s + i.minutes, 0);

  if (!classes.length && !sessions.length) {
    return "Sot nuk ke asgjë të planifikuar. Kohë e mirë për të zënë diçka të mbetur ose për pushim.";
  }

  const load =
    classMinutes >= 240 ? "e ngarkuar" : classMinutes >= 150 ? "mesatare" : "relativisht e lehtë";

  const parts = [`Sot është ditë ${load}.`];
  if (classes.length) {
    parts.push(
      `Ke ${classes.length} ligjërat${classes.length === 1 ? "ë" : "a"} dhe ${sessions.length} sesion${sessions.length === 1 ? "" : "e"} mësimi.`
    );
  } else {
    parts.push(
      sessions.length
        ? `Nuk ke ligjërata — ke ${sessions.length} sesione mësimi.`
        : "Nuk ke ligjërata dhe as sesione të planifikuara."
    );
  }
  if (studyMinutes) parts.push(`Gjithsej ${dur(studyMinutes)} mësim.`);

  return parts.join(" ");
}

/** The single most useful thing to say about where attention should go. */
export function focusHint(state: AppState, today: string): string | null {
  if (!state.subjects.length) return null;

  const ranked = priorities(state, today);
  const top = ranked[0];
  if (!top) return null;

  const subject = state.subjects.find((s) => s.id === top.subjectId);
  if (!subject) return null;

  const exam = top.nextExam;
  if (exam) {
    const days = Math.max(0, Math.round((Date.parse(exam.date) - Date.parse(today)) / 86400000));
    if (days <= 10) {
      return `${subject.name} ka nevojë për më shumë fokus — provimi është pas ${days} ditësh dhe gatishmëria është ${examReadiness(state, exam)}%.`;
    }
  }

  const a = top.urgentAssignment;
  if (a) {
    return `“${a.title}” është ${a.progress}% e përfunduar dhe skadon ${relativeDays(today, a.due)}.`;
  }

  const lowest = [...state.subjects].sort((x, y) => subjectProgress(x) - subjectProgress(y))[0];
  return `${lowest.name} ka progresin më të ulët (${subjectProgress(lowest)}%).`;
}

export interface WeeklyReview {
  minutes: string;
  done: number;
  planned: number;
  consistency: number;
  bestSubject: { name: string; delta: number } | null;
  worstSubject: { name: string; progress: number } | null;
  nextWeek: { deadlines: number; exams: number };
  message: string;
}

export function weeklyReview(state: AppState, today: string): WeeklyReview {
  const ws = weekStats(state, weekStart(today));
  const lastWeek = weekStart(addDays(today, -7));

  let best: { name: string; delta: number } | null = null;
  let worst: { name: string; progress: number } | null = null;

  for (const s of state.subjects) {
    const thisWeek = minutesStudied(state, s.id, weekStart(today));
    const prev = minutesStudied(state, s.id, lastWeek) - thisWeek;
    const delta = prev > 0 ? Math.round(((thisWeek - prev) / prev) * 100) : thisWeek > 0 ? 100 : 0;
    if (!best || delta > best.delta) best = { name: s.name, delta };
    const p = subjectProgress(s);
    if (!worst || p < worst.progress) worst = { name: s.name, progress: p };
  }

  const from = addDays(today, 1);
  const to = addDays(today, 8);
  const deadlines = state.assignments.filter((a) => !a.done && a.due >= from && a.due <= to).length;
  const exams = state.exams.filter((e) => e.date >= from && e.date <= to).length;

  const message = !ws.planned
    ? "Ende pa sesione këtë javë. Gjenero një plan për të filluar."
    : ws.consistency >= 80
      ? `Javë e fortë — ${ws.consistency}% konsistencë. Vazhdo me të njëjtin ritëm.`
      : ws.consistency >= 60
        ? `Javë e mirë, por ${ws.planned - ws.done} sesione mbetën pa u përfunduar.`
        : "Kjo javë shkoi më ngadalë. Provo sesione më të shkurtra për ta rikthyer ritmin.";

  return {
    minutes: ws.label,
    done: ws.done,
    planned: ws.planned,
    consistency: ws.consistency,
    bestSubject: best,
    worstSubject: worst,
    nextWeek: { deadlines, exams },
    message,
  };
}
