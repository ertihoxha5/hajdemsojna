import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMinutes,
  dayIndex,
  daysBetween,
  dur,
  iso,
  minutesOf,
  parseISO,
  relativeDays,
  timeOf,
  weekStart,
  greeting,
} from "@/lib/date.ts";

/**
 * Dates are the one place where a quiet off-by-one turns into a study plan on
 * the wrong day, so the edges get tested explicitly: month rollovers, DST
 * boundaries, and the Monday-first weekday index the whole planner assumes.
 */

describe("iso / parseISO", () => {
  test("formats in local time, not UTC", () => {
    // A late-evening local date must not roll back a day through UTC.
    assert.equal(iso(new Date(2026, 0, 1, 23, 30)), "2026-01-01");
  });

  test("round-trips", () => {
    assert.equal(iso(parseISO("2026-09-17")), "2026-09-17");
  });

  test("pads single-digit months and days", () => {
    assert.equal(iso(new Date(2026, 2, 5)), "2026-03-05");
  });
});

describe("addDays", () => {
  test("crosses a month boundary", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  });

  test("crosses a year boundary", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });

  test("handles a leap day", () => {
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  });

  test("goes backwards", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
});

describe("dayIndex / weekStart", () => {
  test("Monday is 0 and Sunday is 6", () => {
    // 2026-09-14 is a Monday.
    assert.equal(dayIndex("2026-09-14"), 0);
    assert.equal(dayIndex("2026-09-20"), 6);
  });

  test("weekStart returns the Monday of that week", () => {
    assert.equal(weekStart("2026-09-17"), "2026-09-14");
    assert.equal(weekStart("2026-09-20"), "2026-09-14");
    assert.equal(weekStart("2026-09-14"), "2026-09-14");
  });
});

describe("daysBetween", () => {
  test("counts forward and backward", () => {
    assert.equal(daysBetween("2026-09-14", "2026-09-17"), 3);
    assert.equal(daysBetween("2026-09-17", "2026-09-14"), -3);
    assert.equal(daysBetween("2026-09-17", "2026-09-17"), 0);
  });

  test("survives a DST transition", () => {
    // European clocks go forward on 2026-03-29; the rounding in daysBetween
    // exists precisely so this stays a whole number of days.
    assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
    // ...and back again on 2026-10-25.
    assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  });
});

describe("minutesOf / timeOf / addMinutes", () => {
  test("converts both ways", () => {
    assert.equal(minutesOf("09:30"), 570);
    assert.equal(timeOf(570), "09:30");
    assert.equal(timeOf(0), "00:00");
  });

  test("wraps past midnight rather than producing 24:xx", () => {
    assert.equal(addMinutes("23:30", 45), "00:15");
  });

  test("wraps negative values", () => {
    assert.equal(timeOf(-30), "23:30");
  });
});

describe("dur", () => {
  test("renders minutes, whole hours, and both", () => {
    assert.equal(dur(45), "45 min");
    assert.equal(dur(60), "1h");
    assert.equal(dur(95), "1h 35m");
    assert.equal(dur(120), "2h");
    assert.equal(dur(0), "0 min");
  });
});

describe("relativeDays", () => {
  test("uses the Albanian near-day words", () => {
    assert.equal(relativeDays("2026-09-17", "2026-09-17"), "sot");
    assert.equal(relativeDays("2026-09-17", "2026-09-18"), "nesër");
    assert.equal(relativeDays("2026-09-17", "2026-09-19"), "pasnesër");
    assert.equal(relativeDays("2026-09-17", "2026-09-16"), "dje");
  });

  test("counts further days and overdue days", () => {
    assert.equal(relativeDays("2026-09-17", "2026-09-23"), "pas 6 ditësh");
    assert.equal(relativeDays("2026-09-17", "2026-09-15"), "2 ditë vonesë");
  });
});

describe("greeting", () => {
  test("switches at 11:00 and 18:00", () => {
    assert.equal(greeting("10:59"), "Mirëmëngjes");
    assert.equal(greeting("11:00"), "Mirëdita");
    assert.equal(greeting("17:59"), "Mirëdita");
    assert.equal(greeting("18:00"), "Mirëmbrëma");
  });
});
