import type { DayIndex } from "./types";

export const DAYS_LONG = [
  "E hënë",
  "E martë",
  "E mërkurë",
  "E enjte",
  "E premte",
  "E shtunë",
  "E diel",
];

export const DAYS_SHORT = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"];

export const MONTHS = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor",
];

export const MONTHS_SHORT = [
  "Jan",
  "Shk",
  "Mar",
  "Pri",
  "Maj",
  "Qer",
  "Kor",
  "Gus",
  "Sht",
  "Tet",
  "Nën",
  "Dhj",
];

/** "YYYY-MM-DD" for a Date, in local time (never UTC — avoids off-by-one days). */
export function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Monday-first weekday index. */
export function dayIndex(s: string): DayIndex {
  return ((parseISO(s).getDay() + 6) % 7) as DayIndex;
}

/** Monday of the week containing `s`. */
export function weekStart(s: string): string {
  return addDays(s, -dayIndex(s));
}

export function daysBetween(from: string, to: string): number {
  const a = parseISO(from).getTime();
  const b = parseISO(to).getTime();
  return Math.round((b - a) / 86400000);
}

/** "E enjte, 17 Shtator" */
export function longDate(s: string): string {
  const d = parseISO(s);
  return `${DAYS_LONG[dayIndex(s)]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "17 Shtator" */
export function dayMonth(s: string): string {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "17 Sht" */
export function shortDate(s: string): string {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function timeOf(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}`.padStart(2, "0") + ":" + `${m % 60}`.padStart(2, "0");
}

export function addMinutes(hhmm: string, n: number): string {
  return timeOf(minutesOf(hhmm) + n);
}

/** 95 → "1h 35m", 45 → "45 min" */
export function dur(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Relative, human Albanian: "sot", "nesër", "pas 6 ditësh", "2 ditë vonesë" */
export function relativeDays(from: string, to: string): string {
  const n = daysBetween(from, to);
  if (n === 0) return "sot";
  if (n === 1) return "nesër";
  if (n === 2) return "pasnesër";
  if (n === -1) return "dje";
  if (n > 0) return `pas ${n} ditësh`;
  return `${Math.abs(n)} ditë vonesë`;
}

export function daysLabel(n: number): string {
  return n === 1 ? "1 ditë" : `${n} ditë`;
}

/** "Mirëmëngjes" / "Mirëdita" / "Mirëmbrëma" */
export function greeting(hhmm: string): string {
  const m = minutesOf(hhmm);
  if (m < 11 * 60) return "Mirëmëngjes";
  if (m < 18 * 60) return "Mirëdita";
  return "Mirëmbrëma";
}
