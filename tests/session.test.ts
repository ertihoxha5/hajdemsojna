import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  clock,
  end,
  pause,
  phaseDurationSeconds,
  resume,
  skip,
  startSession,
  viewSession,
  type SessionState,
} from "@/lib/spaces/session.ts";

const T0 = 1_800_000_000_000; // a fixed epoch, so nothing depends on the clock
const MIN = 60_000;

const config = { studyMinutes: 50, breakMinutes: 10, rounds: 3 };

describe("startSession", () => {
  test("begins on round 1 of focus, running", () => {
    const s = startSession(config, T0);
    assert.equal(s.mode, "focus");
    assert.equal(s.currentRound, 1);
    assert.equal(s.totalRounds, 3);
    assert.equal(s.paused, false);
    assert.equal(s.phaseStartedAt, T0);
  });

  test("refuses a zero-round or zero-length session", () => {
    const s = startSession({ studyMinutes: 0, breakMinutes: -5, rounds: 0 }, T0);
    assert.ok(s.totalRounds >= 1);
    assert.ok(s.studyMinutes >= 1);
    assert.ok(s.breakMinutes >= 0);
  });
});

describe("viewSession", () => {
  test("counts down in real time", () => {
    const s = startSession(config, T0);

    assert.equal(viewSession(s, T0).remaining, 50 * 60);
    assert.equal(viewSession(s, T0 + 10 * MIN).remaining, 40 * 60);
    assert.equal(viewSession(s, T0 + 10 * MIN).elapsed, 10 * 60);
  });

  test("never reports negative time left", () => {
    const s = startSession(config, T0);
    const view = viewSession(s, T0 + 500 * MIN);
    assert.equal(view.remaining, 0);
    assert.equal(view.expired, true);
  });

  test("progress runs 0 to 1 and stops there", () => {
    const s = startSession(config, T0);
    assert.equal(viewSession(s, T0).progress, 0);
    assert.equal(viewSession(s, T0 + 25 * MIN).progress, 0.5);
    assert.equal(viewSession(s, T0 + 999 * MIN).progress, 1);
  });

  test("two clients at the same instant read the same clock", () => {
    // The whole point of storing phaseStartedAt rather than a client counter.
    const s = startSession(config, T0);
    const a = viewSession(s, T0 + 7 * MIN);
    const b = viewSession(s, T0 + 7 * MIN);
    assert.deepEqual(a, b);
  });

  test("a reload mid-round does not restart the timer", () => {
    const s = startSession(config, T0);
    // "Reloading" is just deriving the view again from the same stored row.
    const reloaded = viewSession({ ...s }, T0 + 12 * MIN);
    assert.equal(reloaded.remaining, 38 * 60);
  });
});

describe("pause and resume", () => {
  test("pausing banks the time already run", () => {
    const s = startSession(config, T0);
    const paused = pause(s, T0 + 10 * MIN);

    assert.equal(paused.paused, true);
    assert.equal(paused.phaseElapsed, 10 * 60);
    assert.equal(paused.phaseStartedAt, null);
  });

  test("a paused clock does not move", () => {
    const paused = pause(startSession(config, T0), T0 + 10 * MIN);

    assert.equal(viewSession(paused, T0 + 10 * MIN).remaining, 40 * 60);
    assert.equal(viewSession(paused, T0 + 90 * MIN).remaining, 40 * 60);
  });

  test("resuming continues from where it stopped", () => {
    const paused = pause(startSession(config, T0), T0 + 10 * MIN);
    const resumed = resume(paused, T0 + 60 * MIN);

    assert.equal(viewSession(resumed, T0 + 60 * MIN).remaining, 40 * 60);
    assert.equal(viewSession(resumed, T0 + 65 * MIN).remaining, 35 * 60);
  });

  test("pausing twice does not double-count", () => {
    const once = pause(startSession(config, T0), T0 + 10 * MIN);
    const twice = pause(once, T0 + 20 * MIN);
    assert.equal(twice.phaseElapsed, 10 * 60);
  });

  test("resuming a running session changes nothing", () => {
    const s = startSession(config, T0);
    assert.deepEqual(resume(s, T0 + MIN), s);
  });
});

describe("advance", () => {
  test("focus leads into a break", () => {
    const next = advance(startSession(config, T0), T0 + 50 * MIN);
    assert.equal(next.mode, "break");
    assert.equal(next.currentRound, 1);
  });

  test("a break leads into the next round of focus", () => {
    const afterFocus = advance(startSession(config, T0), T0 + 50 * MIN);
    const afterBreak = advance(afterFocus, T0 + 60 * MIN);

    assert.equal(afterBreak.mode, "focus");
    assert.equal(afterBreak.currentRound, 2);
  });

  test("the last round ends the session instead of starting a break", () => {
    let s = startSession({ studyMinutes: 50, breakMinutes: 10, rounds: 2 }, T0);
    s = advance(s, T0); // round 1 focus -> break
    s = advance(s, T0); // break -> round 2 focus
    assert.equal(s.currentRound, 2);

    s = advance(s, T0); // last focus -> ended, no trailing break
    assert.equal(s.mode, "ended");
  });

  test("a full cycle produces exactly the configured rounds", () => {
    let s = startSession({ studyMinutes: 25, breakMinutes: 5, rounds: 4 }, T0);
    const focusRounds: number[] = [];

    for (let i = 0; i < 20 && s.mode !== "ended"; i++) {
      if (s.mode === "focus") focusRounds.push(s.currentRound);
      s = advance(s, T0 + i * MIN);
    }

    assert.equal(s.mode, "ended");
    assert.deepEqual(focusRounds, [1, 2, 3, 4]);
  });

  test("advancing a finished session is a no-op", () => {
    const done = end(startSession(config, T0));
    assert.deepEqual(advance(done, T0 + MIN), done);
  });

  test("each new phase starts its clock from zero", () => {
    const next = advance(startSession(config, T0), T0 + 50 * MIN);
    assert.equal(next.phaseElapsed, 0);
    assert.equal(next.phaseStartedAt, T0 + 50 * MIN);
    assert.equal(viewSession(next, T0 + 50 * MIN).remaining, 10 * 60);
  });

  test("advancing clears a pause", () => {
    const paused = pause(startSession(config, T0), T0 + 5 * MIN);
    assert.equal(advance(paused, T0 + 6 * MIN).paused, false);
  });
});

describe("skip and end", () => {
  test("skip moves straight to the next phase", () => {
    const skipped = skip(startSession(config, T0), T0 + MIN);
    assert.equal(skipped.mode, "break");
  });

  test("end stops everything", () => {
    const done = end(startSession(config, T0));
    assert.equal(done.mode, "ended");
    assert.equal(done.paused, false);
    assert.equal(viewSession(done, T0 + 99 * MIN).remaining, 0);
  });
});

describe("phaseDurationSeconds", () => {
  test("uses study length in focus and break length in break", () => {
    const s = startSession(config, T0);
    assert.equal(phaseDurationSeconds(s), 50 * 60);
    assert.equal(phaseDurationSeconds({ ...s, mode: "break" }), 10 * 60);
  });

  test("a finished session has no duration", () => {
    const s: SessionState = { ...startSession(config, T0), mode: "ended" };
    assert.equal(phaseDurationSeconds(s), 0);
  });
});

describe("clock", () => {
  test("formats mm:ss and grows to h:mm:ss", () => {
    assert.equal(clock(0), "00:00");
    assert.equal(clock(59), "00:59");
    assert.equal(clock(2914), "48:34");
    assert.equal(clock(3671), "1:01:11");
  });

  test("never renders a negative time", () => {
    assert.equal(clock(-30), "00:00");
  });
});
