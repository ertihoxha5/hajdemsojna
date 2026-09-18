import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPomodoro, phaseLabel } from "@/lib/pomodoro.ts";

/**
 * The property that matters most: however the session is chopped up, the total
 * work time must equal the session the planner scheduled. A student who was
 * given 90 minutes must not silently study 75.
 */

describe("buildPomodoro", () => {
  test("keeps a short session whole", () => {
    const plan = buildPomodoro(20, 45, 15);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].kind, "punë");
    assert.equal(plan.workSeconds, 20 * 60);
  });

  test("keeps a session exactly one block long whole", () => {
    const plan = buildPomodoro(45, 45, 15);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.rounds, 1);
  });

  test("splits a long session into alternating work and break", () => {
    const plan = buildPomodoro(90, 45, 15);
    assert.deepEqual(
      plan.phases.map((p) => p.kind),
      ["punë", "pushim", "punë"]
    );
    assert.equal(plan.rounds, 2);
  });

  test("never ends on a break", () => {
    for (const minutes of [50, 90, 120, 135, 180]) {
      const plan = buildPomodoro(minutes, 45, 15);
      assert.equal(
        plan.phases[plan.phases.length - 1].kind,
        "punë",
        `${minutes} minutes ended on a break`
      );
    }
  });

  test("preserves the total work time exactly", () => {
    for (const minutes of [20, 45, 50, 90, 100, 135, 180]) {
      const plan = buildPomodoro(minutes, 45, 15);
      assert.equal(
        plan.workSeconds,
        minutes * 60,
        `${minutes} minutes became ${plan.workSeconds / 60}`
      );
    }
  });

  test("handles a remainder shorter than a full block", () => {
    // 100 = 45 + break + 45 + break + 10
    const plan = buildPomodoro(100, 45, 15);
    const work = plan.phases.filter((p) => p.kind === "punë");
    assert.deepEqual(
      work.map((p) => p.seconds / 60),
      [45, 45, 10]
    );
  });

  test("numbers the work rounds consecutively from one", () => {
    const plan = buildPomodoro(135, 45, 15);
    const work = plan.phases.filter((p) => p.kind === "punë");
    assert.deepEqual(
      work.map((p) => p.round),
      [1, 2, 3]
    );
    assert.equal(plan.rounds, 3);
  });

  test("a zero-length break means no splitting at all", () => {
    const plan = buildPomodoro(120, 45, 0);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.workSeconds, 120 * 60);
  });

  test("totalSeconds counts the breaks, workSeconds does not", () => {
    const plan = buildPomodoro(90, 45, 15);
    assert.equal(plan.workSeconds, 90 * 60);
    assert.equal(plan.totalSeconds, 105 * 60);
  });

  test("never produces a zero-length or negative phase", () => {
    for (const minutes of [1, 7, 45, 46, 200]) {
      for (const phase of buildPomodoro(minutes, 45, 15).phases) {
        assert.ok(phase.seconds > 0, `${minutes} produced ${phase.seconds}s`);
      }
    }
  });

  test("survives nonsense preferences without hanging or crashing", () => {
    for (const [session, work, rest] of [
      [90, 0, 15],
      [90, -5, 15],
      [0, 45, 15],
      [-10, 45, 15],
      [90, 45, -5],
    ]) {
      const plan = buildPomodoro(session, work, rest);
      assert.ok(plan.phases.length > 0);
      assert.ok(plan.workSeconds > 0);
    }
  });
});

describe("phaseLabel", () => {
  test("numbers work phases and names breaks", () => {
    const plan = buildPomodoro(135, 45, 15);
    assert.equal(phaseLabel(plan.phases[0], plan.rounds), "Punë 1/3");
    assert.equal(phaseLabel(plan.phases[1], plan.rounds), "Pushim");
    assert.equal(phaseLabel(plan.phases[2], plan.rounds), "Punë 2/3");
  });
});
