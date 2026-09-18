import { addDays } from "./date";

/**
 * Spaced repetition scheduling (SM-2, with the usual modern corrections).
 *
 * This is deliberately a pure function of the card's current state and one
 * grade. It does no I/O, knows nothing about the database, and never asks the
 * model anything — the same review on the same card always produces the same
 * next date. That matters twice over: a student can be told exactly why a card
 * is due, and the behaviour is testable without a network.
 *
 * Where it departs from the 1988 paper, and why:
 *
 *   - A lapse does not wipe the ease factor, only the interval. Resetting both
 *     makes one bad evening undo months of a well-known card.
 *   - The ease factor floors at 1.3, as SM-2 specifies, and is also capped at
 *     2.7 so a card answered easily a few times does not vanish for a year.
 *   - Intervals are capped, because a student's semester is finite: a card due
 *     after the exam is a card that was never studied.
 */

/** What the student said after seeing the answer. */
export type Recall =
  /** No idea — the card is relearned from scratch. */
  | "nuk-e-dita"
  /** Recognised it, but had to think hard. */
  | "veshtire"
  /** Remembered it correctly. */
  | "mire"
  /** Instant, no hesitation. */
  | "lehte";

export const RECALL_ORDER: Recall[] = ["nuk-e-dita", "veshtire", "mire", "lehte"];

/** Albanian labels for the four review buttons. */
export const RECALL_LABELS: Record<Recall, string> = {
  "nuk-e-dita": "Nuk e dita",
  veshtire: "E vështirë",
  mire: "Mirë",
  lehte: "Lehtë",
};

/** SM-2 quality scores, in the 0–5 space the formula expects. */
const QUALITY: Record<Recall, number> = {
  "nuk-e-dita": 0,
  veshtire: 3,
  mire: 4,
  lehte: 5,
};

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.7;
export const MAX_INTERVAL_DAYS = 180;

/** The scheduling state a card carries between reviews. */
export interface CardSchedule {
  /** Days until the next review, as set by the last one. 0 = new. */
  intervalDays: number;
  /** SM-2 ease factor. Higher means the card grows further apart faster. */
  easeFactor: number;
  /** Consecutive successful reviews. Reset to 0 by a lapse. */
  repetitions: number;
  /** Total times this card has been forgotten. Never reset — it is a signal. */
  lapses: number;
}

export interface ScheduleResult extends CardSchedule {
  /** "YYYY-MM-DD" the card next comes up. */
  due: string;
  /** True when the student failed it and it returns in this same session. */
  lapsed: boolean;
}

export function newCardSchedule(): CardSchedule {
  return { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Applies one review and returns the card's new schedule.
 *
 * `today` is passed in rather than read from the clock so that the caller
 * decides what "today" means — the app resolves it in the student's own
 * timezone, not the server's.
 */
export function review(
  card: CardSchedule,
  recall: Recall,
  today: string
): ScheduleResult {
  const quality = QUALITY[recall];
  const failed = quality < 3;

  // Ease moves with the SM-2 curve: easy answers raise it, hard ones lower it.
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const easeFactor = clamp(
    Math.round((card.easeFactor + delta) * 100) / 100,
    MIN_EASE,
    MAX_EASE
  );

  if (failed) {
    // Forgotten: relearn tomorrow, but keep the ease the card has earned.
    return {
      intervalDays: 1,
      easeFactor,
      repetitions: 0,
      lapses: card.lapses + 1,
      due: addDays(today, 1),
      lapsed: true,
    };
  }

  const repetitions = card.repetitions + 1;

  // The first two successes use fixed steps; only after that does the ease
  // factor take over. Without this a new card's second review lands 6 days
  // out on ease alone, which is too far for something just learned.
  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = 1;
  } else if (repetitions === 2) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(card.intervalDays * easeFactor);
  }

  // "E vështirë" means the card is barely holding on; growing the interval by
  // the full ease factor would be optimistic.
  if (recall === "veshtire") {
    intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
  }

  intervalDays = clamp(intervalDays, 1, MAX_INTERVAL_DAYS);

  return {
    intervalDays,
    easeFactor,
    repetitions,
    lapses: card.lapses,
    due: addDays(today, intervalDays),
    lapsed: false,
  };
}

/**
 * What a card would be scheduled for, without committing it.
 *
 * The review buttons show this ("Mirë · pas 6 ditësh"), so the student can see
 * the consequence of their own honesty before they click.
 */
export function previewIntervals(
  card: CardSchedule,
  today: string
): Record<Recall, number> {
  const out = {} as Record<Recall, number>;
  for (const recall of RECALL_ORDER) {
    out[recall] = review(card, recall, today).intervalDays;
  }
  return out;
}

/** "pas 6 ditësh", "nesër", "pas 2 muajsh" — for the review buttons. */
export function intervalLabel(days: number): string {
  if (days <= 0) return "sot";
  if (days === 1) return "nesër";
  if (days < 30) return `pas ${days} ditësh`;
  const months = Math.round(days / 30);
  return months === 1 ? "pas 1 muaji" : `pas ${months} muajsh`;
}

/**
 * How well a set of cards is known, 0..100.
 *
 * Interval length is the honest proxy for retention: a card the student keeps
 * failing stays at one day no matter how often they see it. New cards count
 * as zero rather than being excluded, so the number answers "how much of this
 * deck do I know?" rather than "how am I doing on what I've started?".
 */
export function deckStrength(cards: CardSchedule[]): number {
  if (!cards.length) return 0;
  const total = cards.reduce(
    (sum, c) => sum + Math.min(1, c.intervalDays / 21),
    0
  );
  return Math.round((total / cards.length) * 100);
}

/** The cards to put in front of the student now, hardest-won first. */
export function dueCards<T extends { due: string }>(cards: T[], today: string): T[] {
  return cards
    .filter((c) => c.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due));
}
