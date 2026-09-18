import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import { buildCalendar, buildExport } from "@/server/export.ts";

/**
 * The export is a promise to the student that they can leave with their data,
 * so the things worth testing are: it contains what they made, it excludes
 * their credentials, and the .ics it produces is actually well formed.
 */

const EMAIL = "export-test@export.hajdemsojna.test";
const TODAY = "2026-09-17"; // a Thursday

let userId = "";
let subjectId = "";

async function seed() {
  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "Test",
      surname: "Student",
      passwordHash: "bcrypt-placeholder-should-never-be-exported",
      settings: { create: { aiKeyLast4: "abcd", aiKeyCipher: "secret-cipher" } },
      profile: { create: {} },
      preference: { create: {} },
    },
  });
  userId = user.id;

  const subject = await db.subject.create({
    data: { userId, name: "Analizë Matematike", short: "AM" },
  });
  subjectId = subject.id;

  await db.lecture.create({
    data: { userId, subjectId, day: 0, start: "09:00", end: "10:30", room: "A1" },
  });
  await db.exam.create({
    data: {
      userId,
      subjectId,
      title: "Kolokviumi i parë",
      date: "2026-10-05",
      start: "09:00",
      room: "B2",
    },
  });
  await db.assignment.create({
    data: { userId, subjectId, title: "Detyra 1; me presje, dhe pikëpresje", due: "2026-09-25" },
  });
  await db.studySession.create({
    data: {
      userId,
      subjectId,
      title: "Limitet",
      date: "2026-09-18",
      start: "18:00",
      minutes: 45,
    },
  });
  await db.flashcard.create({
    data: { userId, subjectId, front: "Çfarë është limiti?", back: "Vlera drejt së cilës…", due: TODAY },
  });
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { endsWith: "export.hajdemsojna.test" } } });
}

describe("buildExport", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    await seed();
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("includes the student's own rows", async () => {
    const bundle = await buildExport(userId);

    assert.equal((bundle.subjects as unknown[]).length, 1);
    assert.equal((bundle.exams as unknown[]).length, 1);
    assert.equal((bundle.assignments as unknown[]).length, 1);
    assert.equal((bundle.flashcards as unknown[]).length, 1);
  });

  test("never contains the password hash or the encrypted AI key", async () => {
    const serialised = JSON.stringify(await buildExport(userId));

    assert.ok(
      !serialised.includes("bcrypt-placeholder"),
      "password hash leaked into the export"
    );
    assert.ok(
      !serialised.includes("secret-cipher"),
      "encrypted AI key leaked into the export"
    );
  });

  test("is self-describing, so an importer can check the shape", async () => {
    const bundle = await buildExport(userId);
    assert.equal(bundle.format, "hajdemsojna/export@1");
    assert.ok(Date.parse(bundle.exportedAt) > 0);
  });

  test("contains no other student's data", async () => {
    const other = await db.user.create({
      data: { email: "other-export@export.hajdemsojna.test", name: "Other", surname: "One" },
    });
    await db.subject.create({ data: { userId: other.id, name: "LËNDË E HUAJ" } });

    const serialised = JSON.stringify(await buildExport(userId));
    assert.ok(!serialised.includes("LËNDË E HUAJ"));
  });
});

describe("buildCalendar", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    await seed();
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("produces a well-formed calendar", async () => {
    const ics = await buildCalendar(userId, TODAY);

    assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
    assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
    assert.match(ics, /VERSION:2\.0/);
  });

  test("uses CRLF line endings, as RFC 5545 requires", async () => {
    const ics = await buildCalendar(userId, TODAY);
    const lines = ics.split("\r\n");
    assert.ok(lines.length > 10);
    // No bare LF should survive once the CRLFs are removed.
    assert.ok(!ics.replace(/\r\n/g, "").includes("\n"));
  });

  test("opens and closes every event", async () => {
    const ics = await buildCalendar(userId, TODAY);
    const opens = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    const closes = (ics.match(/END:VEVENT/g) ?? []).length;

    assert.equal(opens, closes);
    assert.equal(opens, 4, "lecture, session, exam and deadline");
  });

  test("makes the lecture weekly and starts it on the right weekday", async () => {
    const ics = await buildCalendar(userId, TODAY);
    assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO/);
    // The next Monday on or after Thursday 2026-09-17 is 2026-09-21.
    assert.match(ics, /DTSTART:20260921T090000/);
  });

  test("escapes semicolons and commas in titles", async () => {
    const ics = await buildCalendar(userId, TODAY);
    // The assignment title contains both; neither may appear raw in SUMMARY.
    const summary = ics
      .split("\r\n")
      .find((l) => l.startsWith("SUMMARY:Afat:"));

    assert.ok(summary, "deadline summary missing");
    assert.ok(summary.includes("\;"), `semicolon not escaped: ${summary}`);
    assert.ok(summary.includes("\,"), `comma not escaped: ${summary}`);
  });

  test("gives the exam an alarm the day before", async () => {
    const ics = await buildCalendar(userId, TODAY);
    assert.match(ics, /BEGIN:VALARM/);
    assert.match(ics, /TRIGGER:-P1D/);
  });

  test("writes the deadline as an all-day event", async () => {
    const ics = await buildCalendar(userId, TODAY);
    assert.match(ics, /DTSTART;VALUE=DATE:20260925/);
    assert.match(ics, /DTEND;VALUE=DATE:20260926/);
  });

  test("contains nothing belonging to another student", async () => {
    const other = await db.user.create({
      data: { email: "other-cal@export.hajdemsojna.test", name: "Other", surname: "One" },
    });
    const otherSubject = await db.subject.create({
      data: { userId: other.id, name: "LËNDË E HUAJ" },
    });
    await db.lecture.create({
      data: {
        userId: other.id,
        subjectId: otherSubject.id,
        day: 2,
        start: "08:00",
        end: "09:00",
      },
    });

    const ics = await buildCalendar(userId, TODAY);
    assert.ok(!ics.includes("LËNDË E HUAJ"));
  });
});
