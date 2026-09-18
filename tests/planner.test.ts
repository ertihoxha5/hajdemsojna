import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  currentGrade,
  examReadiness,
  neededOnRemaining,
  priorities,
  priorityFor,
  subjectProgress,
} from "@/lib/planner.ts";
import * as f from "./fixtures.ts";

const TODAY = "2026-09-17"; // a Thursday

/**
 * The planner decides what a student studies tonight. These tests pin the
 * behaviour that is easy to break silently: the ordering rules, and the
 * arithmetic the AI layer is deliberately not allowed to do itself.
 */

describe("subjectProgress", () => {
  beforeEach(() => f.resetIds());

  test("is 0 with no topics, rather than NaN", () => {
    assert.equal(subjectProgress(f.subject()), 0);
  });

  test("is 100 only when every topic is fully mastered", () => {
    const s = f.subject({
      topics: [f.topic({ mastery: 3 }), f.topic({ mastery: 3 })],
    });
    assert.equal(subjectProgress(s), 100);
  });

  test("averages partial mastery across topics", () => {
    // 3 + 0 out of a possible 6 means 50%.
    const s = f.subject({
      topics: [f.topic({ mastery: 3 }), f.topic({ mastery: 0 })],
    });
    assert.equal(subjectProgress(s), 50);
  });
});

describe("currentGrade", () => {
  beforeEach(() => f.resetIds());

  test("falls back to the stored grade when nothing is recorded", () => {
    const s = f.subject({ currentGrade: 7.5 });
    assert.equal(currentGrade(f.state({ subjects: [s] }), s.id), 7.5);
  });

  test("weights recorded grades by their share of the final", () => {
    const s = f.subject();
    const st = f.state({
      subjects: [s],
      grades: [
        f.grade({ subjectId: s.id, value: 10, weight: 0.75 }),
        f.grade({ subjectId: s.id, value: 6, weight: 0.25 }),
      ],
    });
    // (10*0.75 + 6*0.25) / 1.0 = 9
    assert.equal(currentGrade(st, s.id), 9);
  });

  test("normalises when the weights do not sum to 1", () => {
    const s = f.subject();
    const st = f.state({
      subjects: [s],
      grades: [
        f.grade({ subjectId: s.id, value: 10, weight: 0.2 }),
        f.grade({ subjectId: s.id, value: 8, weight: 0.2 }),
      ],
    });
    assert.equal(currentGrade(st, s.id), 9);
  });

  test("ignores other subjects' grades", () => {
    const mine = f.subject();
    const other = f.subject();
    const st = f.state({
      subjects: [mine, other],
      grades: [f.grade({ subjectId: other.id, value: 4, weight: 1 })],
    });
    assert.equal(currentGrade(st, mine.id), mine.currentGrade);
  });
});

describe("neededOnRemaining", () => {
  beforeEach(() => f.resetIds());

  test("returns null when nothing is left to be graded", () => {
    const s = f.subject();
    const st = f.state({
      subjects: [s],
      grades: [f.grade({ subjectId: s.id, value: 8, weight: 1 })],
    });
    assert.equal(neededOnRemaining(st, s), null);
  });

  test("computes the mark still needed on the remaining weight", () => {
    const s = f.subject({ targetGrade: 9 });
    const st = f.state({
      subjects: [s],
      grades: [f.grade({ subjectId: s.id, value: 8, weight: 0.5 })],
    });
    // Earned 4.0 of the target 9, so (9-4)/0.5 = 10 on the remaining half.
    const r = neededOnRemaining(st, s)!;
    assert.equal(r.need, 10);
    assert.equal(r.remainingWeight, 50);
    assert.equal(r.reachable, true);
  });

  test("flags a target that is arithmetically out of reach", () => {
    const s = f.subject({ targetGrade: 9 });
    const st = f.state({
      subjects: [s],
      grades: [f.grade({ subjectId: s.id, value: 3, weight: 0.8 })],
    });
    const r = neededOnRemaining(st, s)!;
    assert.equal(r.reachable, false, `need was ${r.need}, should exceed 10`);
  });

  test("flags a target already secured", () => {
    const s = f.subject({ targetGrade: 5 });
    const st = f.state({
      subjects: [s],
      grades: [f.grade({ subjectId: s.id, value: 10, weight: 0.6 })],
    });
    const r = neededOnRemaining(st, s)!;
    assert.equal(r.secured, true, `need was ${r.need}, should be <= 0`);
  });
});

describe("examReadiness", () => {
  beforeEach(() => f.resetIds());

  test("is 0 when the subject is gone", () => {
    const st = f.state();
    assert.equal(examReadiness(st, f.exam({ subjectId: "missing" })), 0);
  });

  test("rises with mastery of the exam's own topics", () => {
    const weak = f.topic({ mastery: 0 });
    const strong = f.topic({ mastery: 3 });
    const s = f.subject({ topics: [weak, strong] });
    const st = f.state({ subjects: [s] });

    const low = examReadiness(st, f.exam({ subjectId: s.id, topicIds: [weak.id] }));
    const high = examReadiness(st, f.exam({ subjectId: s.id, topicIds: [strong.id] }));

    assert.ok(high > low, `${high} should exceed ${low}`);
  });

  test("counts time studied, not just mastery", () => {
    const t = f.topic({ mastery: 1 });
    const s = f.subject({ topics: [t] });
    const st = f.state({ subjects: [s] });

    const none = examReadiness(
      st,
      f.exam({ subjectId: s.id, topicIds: [t.id], studiedMinutes: 0 })
    );
    const lots = examReadiness(
      st,
      f.exam({ subjectId: s.id, topicIds: [t.id], studiedMinutes: 600 })
    );

    assert.ok(lots > none, `${lots} should exceed ${none}`);
  });

  test("never exceeds 100, however much time is logged", () => {
    const t = f.topic({ mastery: 3 });
    const s = f.subject({ topics: [t], currentGrade: 10 });
    const st = f.state({ subjects: [s] });

    const r = examReadiness(
      st,
      f.exam({ subjectId: s.id, topicIds: [t.id], studiedMinutes: 100_000 })
    );
    assert.ok(r <= 100, `readiness was ${r}`);
  });
});

describe("priorityFor", () => {
  beforeEach(() => f.resetIds());

  test("a near, unprepared exam outranks a distant one", () => {
    const near = f.subject({ topics: [f.topic({ mastery: 0 })] });
    const far = f.subject({ topics: [f.topic({ mastery: 0 })] });
    const st = f.state({
      subjects: [near, far],
      exams: [
        f.exam({ subjectId: near.id, date: "2026-09-19" }),
        f.exam({ subjectId: far.id, date: "2026-12-19" }),
      ],
    });

    const a = priorityFor(st, near, TODAY);
    const b = priorityFor(st, far, TODAY);
    assert.ok(a.total > b.total, `${a.total} should exceed ${b.total}`);
  });

  test("an imminent unstarted assignment outranks a nearly finished one", () => {
    const urgent = f.subject();
    const calm = f.subject();
    const st = f.state({
      subjects: [urgent, calm],
      assignments: [
        f.assignment({ subjectId: urgent.id, due: "2026-09-18", progress: 0 }),
        f.assignment({ subjectId: calm.id, due: "2026-09-18", progress: 95 }),
      ],
    });

    assert.ok(
      priorityFor(st, urgent, TODAY).total > priorityFor(st, calm, TODAY).total
    );
  });

  test("ignores assignments already marked done", () => {
    const s = f.subject();
    const withOpen = f.state({
      subjects: [s],
      assignments: [f.assignment({ subjectId: s.id, due: "2026-09-18" })],
    });
    const withDone = f.state({
      subjects: [s],
      assignments: [
        f.assignment({ subjectId: s.id, due: "2026-09-18", done: true }),
      ],
    });

    assert.ok(
      priorityFor(withOpen, s, TODAY).parts.assignmentUrgency >
        priorityFor(withDone, s, TODAY).parts.assignmentUrgency
    );
  });

  test("missed sessions in the last week add recovery weight", () => {
    const s = f.subject();
    const st = f.state({
      subjects: [s],
      sessions: [
        f.session({ subjectId: s.id, status: "missed", date: "2026-09-15" }),
        f.session({ subjectId: s.id, status: "missed", date: "2026-09-16" }),
      ],
    });
    assert.equal(priorityFor(st, s, TODAY).parts.recovery, 16);
  });

  test("a session missed long ago no longer counts", () => {
    const s = f.subject();
    const st = f.state({
      subjects: [s],
      sessions: [
        f.session({ subjectId: s.id, status: "missed", date: "2026-08-01" }),
      ],
    });
    assert.equal(priorityFor(st, s, TODAY).parts.recovery, 0);
  });

  test("a harder subject with the same coverage weighs more", () => {
    const hard = f.subject({ difficulty: 5, topics: [f.topic({ mastery: 0 })] });
    const easy = f.subject({ difficulty: 1, topics: [f.topic({ mastery: 0 })] });
    const st = f.state({ subjects: [hard, easy] });

    assert.ok(
      priorityFor(st, hard, TODAY).parts.weakness >
        priorityFor(st, easy, TODAY).parts.weakness
    );
  });

  test("always produces an Albanian reason", () => {
    const s = f.subject();
    const st = f.state({ subjects: [s] });
    assert.ok(priorityFor(st, s, TODAY).reason.length > 0);
  });
});

describe("priorities", () => {
  beforeEach(() => f.resetIds());

  test("returns every subject, ranked high to low", () => {
    const a = f.subject({ importance: 5 });
    const b = f.subject({ importance: 1 });
    const c = f.subject({ importance: 3 });
    const ranked = priorities(f.state({ subjects: [b, c, a] }), TODAY);

    assert.equal(ranked.length, 3);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].total >= ranked[i].total, "not sorted descending");
    }
    assert.equal(ranked[0].subjectId, a.id);
  });

  test("is empty for a student with no subjects", () => {
    assert.deepEqual(priorities(f.state(), TODAY), []);
  });
});
