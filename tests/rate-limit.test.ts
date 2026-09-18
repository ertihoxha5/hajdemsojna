import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  __resetRateLimits,
  rateLimit,
  rateLimitMessage,
} from "@/lib/rate-limit.ts";

/**
 * The limiter is what stands between one signed-in student and the server's
 * whole API budget, so the properties that matter are: it actually stops them,
 * it stops only them, and being stopped does not extend the punishment.
 */

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  test("allows exactly `max` calls, then refuses", () => {
    const { max } = LIMITS.quiz;

    for (let i = 0; i < max; i++) {
      assert.equal(rateLimit("user-a", "quiz").ok, true, `call ${i + 1} should pass`);
    }

    assert.equal(rateLimit("user-a", "quiz").ok, false);
  });

  test("counts down `remaining` honestly", () => {
    const { max } = LIMITS.plan;
    assert.equal(rateLimit("user-a", "plan").remaining, max - 1);
    assert.equal(rateLimit("user-a", "plan").remaining, max - 2);
  });

  test("buckets are per user", () => {
    const { max } = LIMITS.quiz;
    for (let i = 0; i < max; i++) rateLimit("user-a", "quiz");

    assert.equal(rateLimit("user-a", "quiz").ok, false);
    assert.equal(rateLimit("user-b", "quiz").ok, true, "another student is unaffected");
  });

  test("buckets are per action", () => {
    const { max } = LIMITS.quiz;
    for (let i = 0; i < max; i++) rateLimit("user-a", "quiz");

    assert.equal(rateLimit("user-a", "quiz").ok, false);
    assert.equal(rateLimit("user-a", "chat").ok, true, "chat has its own budget");
  });

  test("a refused call does not push the reset further away", () => {
    const { max } = LIMITS.quiz;
    for (let i = 0; i < max; i++) rateLimit("user-a", "quiz");

    const first = rateLimit("user-a", "quiz");
    const second = rateLimit("user-a", "quiz");

    assert.equal(first.ok, false);
    assert.equal(second.ok, false);
    // Hammering the button must not make the wait longer.
    assert.ok(
      second.retryAfter <= first.retryAfter,
      `retryAfter grew: ${first.retryAfter} → ${second.retryAfter}`
    );
  });

  test("reports a usable retryAfter when refused", () => {
    const { max, windowSeconds } = LIMITS.quiz;
    for (let i = 0; i < max; i++) rateLimit("user-a", "quiz");

    const refused = rateLimit("user-a", "quiz");
    assert.equal(refused.ok, false);
    assert.ok(refused.retryAfter >= 1);
    assert.ok(refused.retryAfter <= windowSeconds);
  });

  test("the window reopens once it has elapsed", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { max, windowSeconds } = LIMITS.quiz;

    for (let i = 0; i < max; i++) rateLimit("user-a", "quiz");
    assert.equal(rateLimit("user-a", "quiz").ok, false);

    t.mock.timers.tick(windowSeconds * 1000 + 1);
    assert.equal(rateLimit("user-a", "quiz").ok, true, "budget resets after the window");
  });
});

describe("rateLimitMessage", () => {
  test("uses seconds under a minute and minutes above it", () => {
    assert.match(rateLimitMessage(30), /30 sekondash/);
    assert.match(rateLimitMessage(60), /60 sekondash/);
    assert.match(rateLimitMessage(300), /5 minutash/);
  });

  test("rounds partial minutes up, never to zero", () => {
    assert.match(rateLimitMessage(61), /2 minutash/);
  });
});
