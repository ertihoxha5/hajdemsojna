import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_BADGE,
  ACTIVITY_LABEL,
  AWAY_AFTER_SECONDS,
  DISCONNECTED_AFTER_SECONDS,
  IDLE_AFTER_SECONDS,
  POINTS,
  countsAsPresent,
  groupFocus,
  resolveActivity,
  roundPoints,
  shouldCheckIn,
  type Activity,
  type PresenceSignals,
} from "@/lib/spaces/presence.ts";
import {
  avatarFromSeed,
  defaultAvatar,
  parseAvatar,
  serialiseAvatar,
  SKIN_TONES,
  HAIR_COLORS,
} from "@/lib/avatar.ts";

const NOW = 1_800_000_000_000;

function signals(over: Partial<PresenceSignals> = {}): PresenceSignals {
  return {
    lastActiveAt: NOW,
    lastSeenAt: NOW,
    visible: true,
    connected: true,
    ...over,
  };
}

describe("resolveActivity", () => {
  test("a visible tab with recent input is active", () => {
    assert.equal(resolveActivity(signals(), NOW), "active");
  });

  test("a hidden tab is idle straight away", () => {
    // The student is demonstrably looking at something else.
    assert.equal(resolveActivity(signals({ visible: false }), NOW), "idle");
  });

  test("no input for the idle timeout is idle, even with the tab visible", () => {
    const s = signals({ lastActiveAt: NOW - (IDLE_AFTER_SECONDS + 5) * 1000 });
    assert.equal(resolveActivity(s, NOW), "idle");
  });

  test("no input for the away timeout is away", () => {
    const s = signals({ lastActiveAt: NOW - (AWAY_AFTER_SECONDS + 5) * 1000 });
    assert.equal(resolveActivity(s, NOW), "away");
  });

  test("a dropped connection outranks everything else", () => {
    // Someone whose laptop slept is not "idle at their desk".
    const s = signals({ connected: false, lastActiveAt: NOW });
    assert.equal(resolveActivity(s, NOW), "disconnected");
  });

  test("a stale heartbeat counts as disconnected", () => {
    const s = signals({
      lastSeenAt: NOW - (DISCONNECTED_AFTER_SECONDS + 5) * 1000,
    });
    assert.equal(resolveActivity(s, NOW), "disconnected");
  });

  test("becoming away is never instant", () => {
    // One blink must not cost someone their status.
    const s = signals({ lastActiveAt: NOW - 1000, visible: false });
    assert.equal(resolveActivity(s, NOW), "idle");
  });

  test("returning to the tab restores active", () => {
    const away = resolveActivity(signals({ visible: false }), NOW);
    assert.equal(away, "idle");
    assert.equal(resolveActivity(signals({ visible: true }), NOW), "active");
  });
});

describe("countsAsPresent", () => {
  test("active and idle earn credit, away and disconnected do not", () => {
    assert.equal(countsAsPresent("active"), true);
    assert.equal(countsAsPresent("idle"), true);
    assert.equal(countsAsPresent("away"), false);
    assert.equal(countsAsPresent("disconnected"), false);
  });
});

describe("shouldCheckIn", () => {
  test("only an idle student is asked whether they are still there", () => {
    assert.equal(shouldCheckIn("idle"), true);
    assert.equal(shouldCheckIn("active"), false);
    // Already away: asking again would just be nagging.
    assert.equal(shouldCheckIn("away"), false);
    assert.equal(shouldCheckIn("disconnected"), false);
  });
});

describe("status presentation", () => {
  test("every status has a label and a non-colour glyph", () => {
    const all: Activity[] = ["active", "idle", "away", "disconnected"];
    for (const a of all) {
      assert.ok(ACTIVITY_LABEL[a], `${a} has no label`);
      assert.ok(ACTIVITY_BADGE[a].glyph, `${a} has no glyph`);
    }
  });

  test("the glyphs are distinct, so colour is never the only signal", () => {
    const glyphs = Object.values(ACTIVITY_BADGE).map((b) => b.glyph);
    assert.equal(new Set(glyphs).size, glyphs.length);
  });
});

describe("roundPoints", () => {
  test("a fully attended round pays the full amount", () => {
    assert.equal(roundPoints(3000, 3000), POINTS.perFocusRound);
  });

  test("partial attendance pays proportionally", () => {
    assert.equal(roundPoints(1500, 3000), Math.round(POINTS.perFocusRound * 0.5));
  });

  test("barely attending pays nothing", () => {
    assert.equal(roundPoints(100, 3000), 0);
  });

  test("never pays more than the full amount, even past the end", () => {
    assert.equal(roundPoints(99_999, 3000), POINTS.perFocusRound);
  });

  test("is never negative — inactivity stops earning, it does not punish", () => {
    assert.equal(roundPoints(0, 3000), 0);
    assert.ok(roundPoints(0, 3000) >= 0);
  });

  test("a zero-length round pays nothing rather than dividing by zero", () => {
    assert.equal(roundPoints(60, 0), 0);
  });
});

describe("groupFocus", () => {
  test("an empty room is 0, not NaN", () => {
    assert.equal(groupFocus([]), 0);
  });

  test("everyone active is 100", () => {
    assert.equal(groupFocus(["active", "active", "active"]), 100);
  });

  test("everyone gone is 0", () => {
    assert.equal(groupFocus(["away", "disconnected"]), 0);
  });

  test("idle members count for something but less than active", () => {
    const allIdle = groupFocus(["idle", "idle"]);
    assert.ok(allIdle > 0 && allIdle < 100, `was ${allIdle}`);
  });

  test("the score falls as people drop off", () => {
    const full = groupFocus(["active", "active", "active", "active"]);
    const partial = groupFocus(["active", "active", "away", "away"]);
    assert.ok(partial < full);
  });
});

describe("avatar", () => {
  test("an unset avatar falls back to the default", () => {
    assert.deepEqual(parseAvatar(null), defaultAvatar());
    assert.deepEqual(parseAvatar(""), defaultAvatar());
  });

  test("malformed JSON gives a plain character rather than throwing", () => {
    assert.deepEqual(parseAvatar("{not json"), defaultAvatar());
    assert.deepEqual(parseAvatar("[]"), defaultAvatar());
  });

  test("round-trips through storage", () => {
    const avatar = { ...defaultAvatar(), hair: 3, shirt: 4, accessory: 2 };
    assert.deepEqual(parseAvatar(serialiseAvatar(avatar)), avatar);
  });

  test("an out-of-range index resolves to a real variant", () => {
    const parsed = parseAvatar(JSON.stringify({ ...defaultAvatar(), skin: 999 }));
    assert.ok(parsed.skin >= 0 && parsed.skin < SKIN_TONES.length);
  });

  test("a negative index resolves to a real variant", () => {
    const parsed = parseAvatar(
      JSON.stringify({ ...defaultAvatar(), hairColor: -3 })
    );
    assert.ok(parsed.hairColor >= 0 && parsed.hairColor < HAIR_COLORS.length);
  });

  test("ignores fields that are not whole numbers", () => {
    const parsed = parseAvatar(JSON.stringify({ hair: "red", shirt: 2.5 }));
    assert.equal(parsed.hair, defaultAvatar().hair);
    assert.equal(parsed.shirt, defaultAvatar().shirt);
  });

  test("a seeded avatar is stable and in range", () => {
    const a = avatarFromSeed("user-abc");
    const b = avatarFromSeed("user-abc");
    assert.deepEqual(a, b);
    assert.ok(a.skin >= 0 && a.skin < SKIN_TONES.length);
  });

  test("different users get different seeded avatars", () => {
    const seeds = ["a", "b", "c", "d", "e", "f"].map((s) =>
      JSON.stringify(avatarFromSeed(s))
    );
    assert.ok(new Set(seeds).size > 1, "every seed produced the same avatar");
  });
});
