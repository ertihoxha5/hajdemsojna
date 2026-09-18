import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_EASE,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  RECALL_ORDER,
  type CardSchedule,
  type Recall,
  deckStrength,
  dueCards,
  intervalLabel,
  newCardSchedule,
  previewIntervals,
  review,
} from "@/lib/srs.ts";

const TODAY = "2026-09-17";

/** Answers a card the same way `n` times, returning the final schedule. */
function drill(recall: Recall, times: number, from = newCardSchedule()) {
  let card: CardSchedule = from;
  let date = TODAY;
  for (let i = 0; i < times; i++) {
    const next = review(card, recall, date);
    card = next;
    date = next.due;
  }
  return card;
}

describe("review — a card the student knows", () => {
  test("a new card answered well comes back tomorrow", () => {
    const r = review(newCardSchedule(), "mire", TODAY);
    assert.equal(r.intervalDays, 1);
    assert.equal(r.due, "2026-09-18");
    assert.equal(r.repetitions, 1);
    assert.equal(r.lapsed, false);
  });

  test("the second success uses the fixed six-day step", () => {
    const first = review(newCardSchedule(), "mire", TODAY);
    const second = review(first, "mire", first.due);
    assert.equal(second.intervalDays, 6);
    assert.equal(second.repetitions, 2);
  });

  test("from the third success the interval grows by the ease factor", () => {
    const first = review(newCardSchedule(), "mire", TODAY);
    const second = review(first, "mire", first.due);
    const third = review(second, "mire", second.due);

    assert.equal(third.intervalDays, Math.round(6 * third.easeFactor));
    assert.ok(third.intervalDays > second.intervalDays);
  });

  test("intervals keep growing across a long streak", () => {
    let card: CardSchedule = newCardSchedule();
    let date = TODAY;
    const seen: number[] = [];

    for (let i = 0; i < 6; i++) {
      const next = review(card, "mire", date);
      seen.push(next.intervalDays);
      card = next;
      date = next.due;
    }

    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i] >= seen[i - 1], `interval shrank: ${seen}`);
    }
  });

  test("easy raises the ease factor, good roughly holds it", () => {
    const easy = review(newCardSchedule(), "lehte", TODAY);
    const good = review(newCardSchedule(), "mire", TODAY);
    assert.ok(easy.easeFactor > good.easeFactor);
  });

  test("hard lowers the ease factor and shortens the step", () => {
    const base = drill("mire", 3);
    const good = review(base, "mire", TODAY);
    const hard = review(base, "veshtire", TODAY);

    assert.ok(hard.easeFactor < good.easeFactor);
    assert.ok(hard.intervalDays < good.intervalDays);
  });
});

describe("review — a card the student has forgotten", () => {
  test("goes back to tomorrow and counts a lapse", () => {
    const mature = drill("mire", 4);
    const failed = review(mature, "nuk-e-dita", TODAY);

    assert.equal(failed.intervalDays, 1);
    assert.equal(failed.due, "2026-09-18");
    assert.equal(failed.repetitions, 0);
    assert.equal(failed.lapses, mature.lapses + 1);
    assert.equal(failed.lapsed, true);
  });

  test("does not wipe the ease the card had earned", () => {
    // The documented departure from SM-2: one bad evening must not undo months.
    const mature = drill("lehte", 4);
    const failed = review(mature, "nuk-e-dita", TODAY);

    assert.ok(
      failed.easeFactor > MIN_EASE,
      `ease collapsed to ${failed.easeFactor}`
    );
  });

  test("lapses accumulate and are never reset by later success", () => {
    const failed = review(drill("mire", 3), "nuk-e-dita", TODAY);
    const recovered = review(failed, "mire", failed.due);
    assert.equal(recovered.lapses, failed.lapses);
  });

  test("repeated failure drives ease to the floor but no lower", () => {
    const beaten = drill("nuk-e-dita", 12);
    assert.equal(beaten.easeFactor, MIN_EASE);
  });
});

describe("bounds", () => {
  test("ease never exceeds the cap, however easy the card", () => {
    const easy = drill("lehte", 20);
    assert.ok(easy.easeFactor <= MAX_EASE, `ease was ${easy.easeFactor}`);
  });

  test("intervals are capped so a card cannot outrun the semester", () => {
    const easy = drill("lehte", 20);
    assert.ok(
      easy.intervalDays <= MAX_INTERVAL_DAYS,
      `interval was ${easy.intervalDays}`
    );
  });

  test("a successful review is never scheduled for today", () => {
    for (const recall of ["veshtire", "mire", "lehte"] as Recall[]) {
      const r = review(newCardSchedule(), recall, TODAY);
      assert.ok(r.intervalDays >= 1, `${recall} gave ${r.intervalDays}`);
      assert.ok(r.due > TODAY, `${recall} due ${r.due}`);
    }
  });

  test("is a pure function — it does not mutate the card passed in", () => {
    const card = newCardSchedule();
    const snapshot = { ...card };
    review(card, "lehte", TODAY);
    assert.deepEqual(card, snapshot);
  });

  test("the same input always gives the same output", () => {
    const card = drill("mire", 3);
    assert.deepEqual(review(card, "mire", TODAY), review(card, "mire", TODAY));
  });
});

describe("previewIntervals", () => {
  test("covers every button and matches what review would do", () => {
    const card = drill("mire", 2);
    const preview = previewIntervals(card, TODAY);

    assert.equal(Object.keys(preview).length, RECALL_ORDER.length);
    for (const recall of RECALL_ORDER) {
      assert.equal(preview[recall], review(card, recall, TODAY).intervalDays);
    }
  });

  test("the buttons are ordered from soonest to furthest away", () => {
    const preview = previewIntervals(drill("mire", 3), TODAY);
    assert.ok(preview["nuk-e-dita"] <= preview["veshtire"]);
    assert.ok(preview["veshtire"] <= preview["mire"]);
    assert.ok(preview["mire"] <= preview["lehte"]);
  });
});

describe("intervalLabel", () => {
  test("reads naturally in Albanian at each scale", () => {
    assert.equal(intervalLabel(0), "sot");
    assert.equal(intervalLabel(1), "nesër");
    assert.equal(intervalLabel(6), "pas 6 ditësh");
    assert.equal(intervalLabel(30), "pas 1 muaji");
    assert.equal(intervalLabel(90), "pas 3 muajsh");
  });
});

describe("deckStrength", () => {
  test("an empty deck is 0, not NaN", () => {
    assert.equal(deckStrength([]), 0);
  });

  test("a deck of new cards is 0", () => {
    assert.equal(deckStrength([newCardSchedule(), newCardSchedule()]), 0);
  });

  test("rises as cards mature, and caps at 100", () => {
    const young = deckStrength([drill("mire", 2)]);
    const old = deckStrength([drill("mire", 6)]);

    assert.ok(old > young, `${old} should exceed ${young}`);
    assert.ok(old <= 100);
  });

  test("a half-known deck lands between the extremes", () => {
    const strength = deckStrength([drill("mire", 6), newCardSchedule()]);
    assert.ok(strength > 0 && strength < 100, `was ${strength}`);
  });
});

describe("dueCards", () => {
  test("returns only cards due today or earlier, oldest first", () => {
    const cards = [
      { id: "future", due: "2026-09-20" },
      { id: "today", due: TODAY },
      { id: "overdue", due: "2026-09-10" },
    ];

    assert.deepEqual(
      dueCards(cards, TODAY).map((c) => c.id),
      ["overdue", "today"]
    );
  });

  test("is empty when nothing is due", () => {
    assert.deepEqual(dueCards([{ due: "2026-12-01" }], TODAY), []);
  });
});
