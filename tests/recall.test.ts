import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import {
  createCards,
  dueQueue,
  recallSummary,
  recordQuizAttempt,
  reviewCard,
  quizAccuracy,
} from "@/server/recall.ts";

/**
 * The data layer's job is ownership and honesty: a card id belonging to another
 * student must match nothing, and a quiz score must come from the answers
 * rather than from whatever the client claimed.
 */

const DOMAIN = "recall.hajdemsojna.test";
const TODAY = "2026-09-17";

let userId = "";
let otherId = "";
let subjectId = "";

async function seed() {
  const user = await db.user.create({
    data: { email: `me@${DOMAIN}`, name: "Test", surname: "Student" },
  });
  userId = user.id;

  const other = await db.user.create({
    data: { email: `other@${DOMAIN}`, name: "Other", surname: "Student" },
  });
  otherId = other.id;

  const subject = await db.subject.create({
    data: { userId, name: "Fizikë" },
  });
  subjectId = subject.id;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

describe("flashcard data layer", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    await seed();
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("new cards are due immediately, so they can be started today", async () => {
    await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    const queue = await dueQueue(userId, TODAY);

    assert.equal(queue.length, 1);
    assert.equal(queue[0].due, TODAY);
    assert.equal(queue[0].repetitions, 0);
  });

  test("a forged subject id lands the card unfiled, not in another student's subject", async () => {
    const theirs = await db.subject.create({
      data: { userId: otherId, name: "E HUAJ" },
    });

    const [card] = await createCards(userId, TODAY, [
      { front: "P", back: "B", subjectId: theirs.id },
    ]);

    assert.equal(card.subjectId, null);
  });

  test("reviewing pushes the card into the future", async () => {
    const [card] = await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    const outcome = await reviewCard(userId, TODAY, card.id, "mire");

    assert.ok(outcome);
    assert.ok(outcome.due > TODAY, `still due ${outcome.due}`);
    assert.equal(await dueQueue(userId, TODAY).then((q) => q.length), 0);
  });

  test("a review is recorded as history", async () => {
    const [card] = await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    await reviewCard(userId, TODAY, card.id, "veshtire");

    const reviews = await db.flashcardReview.findMany({ where: { userId } });
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].recall, "veshtire");
  });

  test("another student cannot review my card", async () => {
    const [card] = await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);

    assert.equal(await reviewCard(otherId, TODAY, card.id, "lehte"), null);
    const untouched = await db.flashcard.findUniqueOrThrow({ where: { id: card.id } });
    assert.equal(untouched.repetitions, 0);
  });

  test("a failed card comes back tomorrow and counts a lapse", async () => {
    const [card] = await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    await reviewCard(userId, TODAY, card.id, "mire");
    const failed = await reviewCard(userId, TODAY, card.id, "nuk-e-dita");

    assert.ok(failed);
    assert.equal(failed.lapsed, true);
    assert.equal(failed.card.lapses, 1);
  });

  test("suspended cards never reach the queue", async () => {
    const [card] = await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    await db.flashcard.update({ where: { id: card.id }, data: { suspended: true } });

    assert.equal(await dueQueue(userId, TODAY).then((q) => q.length), 0);
  });

  test("the summary counts only this student's cards", async () => {
    await createCards(userId, TODAY, [{ front: "P", back: "B", subjectId }]);
    await createCards(otherId, TODAY, [{ front: "X", back: "Y" }]);

    const summary = await recallSummary(userId, TODAY);
    assert.equal(summary.total, 1);
    assert.equal(summary.due, 1);
  });
});

describe("quiz attempts", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    await seed();
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  const answers = (chosen: number[]) =>
    chosen.map((c, i) => ({
      question: `Pyetja ${i + 1}`,
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
      chosenIndex: c,
      explanation: "",
      topicName: "",
    }));

  test("scores the attempt from the answers", async () => {
    const result = await recordQuizAttempt(userId, TODAY, {
      subjectId,
      source: "ai",
      seconds: 60,
      answers: answers([0, 0, 1, 2]),
    });

    assert.equal(result.total, 4);
    assert.equal(result.correct, 2);
  });

  test("a skipped question counts as wrong, never as right", async () => {
    const result = await recordQuizAttempt(userId, TODAY, {
      subjectId,
      source: "ai",
      seconds: 0,
      answers: answers([-1, -1]),
    });

    assert.equal(result.correct, 0);
  });

  test("ignores a forged subject id rather than filing under it", async () => {
    const theirs = await db.subject.create({
      data: { userId: otherId, name: "E HUAJ" },
    });

    const result = await recordQuizAttempt(userId, TODAY, {
      subjectId: theirs.id,
      source: "ai",
      seconds: 0,
      answers: answers([0]),
    });

    const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(stored.subjectId, null);
  });

  test("accuracy is null before anything has been attempted", async () => {
    assert.equal(await quizAccuracy(userId, subjectId), null);
  });

  test("accuracy weights by questions asked, not by attempt", async () => {
    // 1/1 then 0/10: averaging attempts would say 50%, which would be wrong.
    await recordQuizAttempt(userId, TODAY, {
      subjectId,
      source: "ai",
      seconds: 0,
      answers: answers([0]),
    });
    await recordQuizAttempt(userId, TODAY, {
      subjectId,
      source: "ai",
      seconds: 0,
      answers: answers(Array(10).fill(3)),
    });

    const accuracy = await quizAccuracy(userId, subjectId);
    assert.ok(accuracy !== null);
    assert.ok(Math.abs(accuracy - 1 / 11) < 0.001, `was ${accuracy}`);
  });

  test("one student's attempts never count toward another's accuracy", async () => {
    const theirSubject = await db.subject.create({
      data: { userId: otherId, name: "Fizikë" },
    });
    await recordQuizAttempt(otherId, TODAY, {
      subjectId: theirSubject.id,
      source: "ai",
      seconds: 0,
      answers: answers([0, 0, 0]),
    });

    assert.equal(await quizAccuracy(userId, subjectId), null);
  });
});
