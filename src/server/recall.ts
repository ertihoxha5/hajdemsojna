import "server-only";
import { db } from "@/lib/db";
import { newCardSchedule, review, type Recall } from "@/lib/srs";

/**
 * Data access for flashcards and quiz attempts.
 *
 * Like everything in src/server, every query is filtered by the authenticated
 * user id — a card id from a request body that belongs to someone else simply
 * matches nothing. The scheduling arithmetic itself lives in src/lib/srs.ts and
 * is not duplicated here: this file decides *what* to write, never *when* the
 * card comes back.
 */

export interface CardWire {
  id: string;
  front: string;
  back: string;
  subjectId: string | null;
  topicId: string | null;
  source: string;
  due: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastReviewed: string | null;
  suspended: boolean;
}

type CardRow = {
  id: string;
  front: string;
  back: string;
  subjectId: string | null;
  topicId: string | null;
  source: string;
  due: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastReviewed: string | null;
  suspended: boolean;
};

function toWire(card: CardRow): CardWire {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    subjectId: card.subjectId,
    topicId: card.topicId,
    source: card.source,
    due: card.due,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
    repetitions: card.repetitions,
    lapses: card.lapses,
    lastReviewed: card.lastReviewed,
    suspended: card.suspended,
  };
}

/* ── Reading ─────────────────────────────────────────────── */

export async function listCards(
  userId: string,
  options: { subjectId?: string } = {}
): Promise<CardWire[]> {
  const cards = await db.flashcard.findMany({
    where: {
      userId,
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
    },
    orderBy: [{ due: "asc" }, { createdAt: "asc" }],
  });
  return cards.map(toWire);
}

/**
 * The cards to study right now.
 *
 * Suspended cards are excluded, and the queue is capped: a student returning
 * after two weeks away should be shown a session they will actually finish,
 * not four hundred cards.
 */
export async function dueQueue(
  userId: string,
  today: string,
  options: { subjectId?: string; limit?: number } = {}
): Promise<CardWire[]> {
  const cards = await db.flashcard.findMany({
    where: {
      userId,
      suspended: false,
      due: { lte: today },
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
    },
    orderBy: [{ due: "asc" }, { createdAt: "asc" }],
    take: options.limit ?? 40,
  });
  return cards.map(toWire);
}

export interface RecallSummary {
  total: number;
  due: number;
  fresh: number;
  learning: number;
  mature: number;
  reviewedToday: number;
}

/** Counts for the dashboard — one query per bucket, no rows loaded. */
export async function recallSummary(
  userId: string,
  today: string
): Promise<RecallSummary> {
  const [total, due, fresh, learning, mature, reviewedToday] = await Promise.all([
    db.flashcard.count({ where: { userId } }),
    db.flashcard.count({ where: { userId, suspended: false, due: { lte: today } } }),
    db.flashcard.count({ where: { userId, repetitions: 0 } }),
    db.flashcard.count({ where: { userId, repetitions: { gt: 0 }, intervalDays: { lt: 21 } } }),
    db.flashcard.count({ where: { userId, intervalDays: { gte: 21 } } }),
    db.flashcardReview.count({ where: { userId, date: today } }),
  ]);

  return { total, due, fresh, learning, mature, reviewedToday };
}

/* ── Writing ─────────────────────────────────────────────── */

export interface NewCard {
  front: string;
  back: string;
  subjectId?: string | null;
  topicId?: string | null;
  source?: string;
  materialId?: string | null;
}

/**
 * Creates cards, due immediately so the student can start on them today.
 *
 * Subject and topic ids are re-resolved against this user's own rows, so a
 * forged id lands the card in the unfiled pile rather than in someone else's
 * subject.
 */
export async function createCards(
  userId: string,
  today: string,
  cards: NewCard[]
): Promise<CardWire[]> {
  if (!cards.length) return [];

  const subjectIds = [
    ...new Set(cards.map((c) => c.subjectId).filter((id): id is string => !!id)),
  ];
  const owned = subjectIds.length
    ? await db.subject.findMany({
        where: { id: { in: subjectIds }, userId },
        select: { id: true, topics: { select: { id: true } } },
      })
    : [];

  const ownedSubjects = new Set(owned.map((s) => s.id));
  const ownedTopics = new Set(owned.flatMap((s) => s.topics.map((t) => t.id)));
  const base = newCardSchedule();

  const created: CardWire[] = [];
  for (const card of cards) {
    const subjectId =
      card.subjectId && ownedSubjects.has(card.subjectId) ? card.subjectId : null;
    const topicId =
      card.topicId && ownedTopics.has(card.topicId) ? card.topicId : null;

    const row = await db.flashcard.create({
      data: {
        userId,
        subjectId,
        topicId,
        front: card.front,
        back: card.back,
        source: card.source ?? "manual",
        materialId: card.materialId ?? null,
        due: today,
        intervalDays: base.intervalDays,
        easeFactor: base.easeFactor,
        repetitions: base.repetitions,
        lapses: base.lapses,
      },
    });
    created.push(toWire(row));
  }

  return created;
}

export interface ReviewOutcome {
  card: CardWire;
  intervalDays: number;
  due: string;
  lapsed: boolean;
}

/**
 * Records one review and reschedules the card.
 *
 * A successful review also nudges the linked topic's mastery upward, so the
 * planner and exam readiness reflect recall the student has actually
 * demonstrated rather than only what they self-reported.
 */
export async function reviewCard(
  userId: string,
  today: string,
  cardId: string,
  recall: Recall
): Promise<ReviewOutcome | null> {
  const card = await db.flashcard.findFirst({ where: { id: cardId, userId } });
  if (!card) return null;

  const next = review(
    {
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      repetitions: card.repetitions,
      lapses: card.lapses,
    },
    recall,
    today
  );

  const [updated] = await Promise.all([
    db.flashcard.update({
      where: { id: card.id },
      data: {
        due: next.due,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        repetitions: next.repetitions,
        lapses: next.lapses,
        lastReviewed: today,
      },
    }),
    db.flashcardReview.create({
      data: {
        cardId: card.id,
        userId,
        recall,
        intervalDays: next.intervalDays,
        date: today,
      },
    }),
  ]);

  // A card held for three weeks is one the student genuinely knows.
  if (card.topicId && next.intervalDays >= 21) {
    await db.topic.updateMany({
      where: { id: card.topicId, subject: { userId } },
      data: { mastery: 3 },
    });
  }

  return {
    card: toWire(updated),
    intervalDays: next.intervalDays,
    due: next.due,
    lapsed: next.lapsed,
  };
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
  await db.flashcard.deleteMany({ where: { id: cardId, userId } });
}

export async function setCardSuspended(
  userId: string,
  cardId: string,
  suspended: boolean
): Promise<void> {
  await db.flashcard.updateMany({ where: { id: cardId, userId }, data: { suspended } });
}

/* ── Quiz attempts ───────────────────────────────────────── */

export interface NewQuizAnswer {
  question: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number;
  explanation: string;
  topicName: string;
}

/**
 * Stores a finished quiz.
 *
 * `correct` is recomputed here from the answers rather than trusted from the
 * request body — otherwise a student could post themselves a perfect score and
 * quietly corrupt their own readiness numbers.
 */
export async function recordQuizAttempt(
  userId: string,
  today: string,
  attempt: {
    subjectId?: string | null;
    materialId?: string | null;
    source: string;
    seconds: number;
    answers: NewQuizAnswer[];
  }
): Promise<{ id: string; correct: number; total: number }> {
  const subjectId = attempt.subjectId
    ? (await db.subject.findFirst({
        where: { id: attempt.subjectId, userId },
        select: { id: true },
      }))?.id ?? null
    : null;

  const answers = attempt.answers.map((a, position) => ({
    question: a.question,
    options: JSON.stringify(a.options),
    correctIndex: a.correctIndex,
    chosenIndex: a.chosenIndex,
    correct: a.chosenIndex === a.correctIndex,
    explanation: a.explanation,
    topicName: a.topicName,
    position,
  }));

  const correct = answers.filter((a) => a.correct).length;

  const created = await db.quizAttempt.create({
    data: {
      userId,
      subjectId,
      materialId: attempt.materialId ?? null,
      source: attempt.source,
      total: answers.length,
      correct,
      seconds: attempt.seconds,
      date: today,
      answers: { create: answers },
    },
    select: { id: true },
  });

  return { id: created.id, correct, total: answers.length };
}

export interface AttemptWire {
  id: string;
  subjectId: string | null;
  total: number;
  correct: number;
  date: string;
  seconds: number;
}

export async function listQuizAttempts(
  userId: string,
  options: { subjectId?: string; limit?: number } = {}
): Promise<AttemptWire[]> {
  const rows = await db.quizAttempt.findMany({
    where: { userId, ...(options.subjectId ? { subjectId: options.subjectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 20,
    select: {
      id: true,
      subjectId: true,
      total: true,
      correct: true,
      date: true,
      seconds: true,
    },
  });
  return rows;
}

/** One attempt with its questions, for the "what did I get wrong" screen. */
export async function getQuizAttempt(userId: string, attemptId: string) {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { answers: { orderBy: { position: "asc" } } },
  });
  if (!attempt) return null;

  return {
    id: attempt.id,
    subjectId: attempt.subjectId,
    total: attempt.total,
    correct: attempt.correct,
    date: attempt.date,
    seconds: attempt.seconds,
    answers: attempt.answers.map((a) => ({
      question: a.question,
      options: safeOptions(a.options),
      correctIndex: a.correctIndex,
      chosenIndex: a.chosenIndex,
      correct: a.correct,
      explanation: a.explanation,
      topicName: a.topicName,
    })),
  };
}

/** The options column is serialised JSON; a malformed row must not 500. */
function safeOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Recent quiz accuracy for a subject, 0..1, or null when there is nothing to
 * go on. Used by exam readiness, which must not guess when it has no data.
 */
export async function quizAccuracy(
  userId: string,
  subjectId: string,
  limit = 5
): Promise<number | null> {
  const attempts = await db.quizAttempt.findMany({
    where: { userId, subjectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { total: true, correct: true },
  });

  const total = attempts.reduce((s, a) => s + a.total, 0);
  if (!total) return null;

  return attempts.reduce((s, a) => s + a.correct, 0) / total;
}
