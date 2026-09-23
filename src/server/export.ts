import "server-only";
import { db } from "@/lib/db";

/**
 * Account export.
 *
 * The account can already be deleted in one click; being able to take the data
 * out first is the other half of that promise. This returns everything the
 * student created, in a shape a person can actually read, with two deliberate
 * omissions:
 *
 *   - the bcrypt password hash and session tokens, which are credentials, not
 *     data the student needs
 *   - the encrypted AI key, which cannot be decrypted outside this server and
 *     would only be an inert blob
 *
 * Uploaded material files are referenced by name and size rather than inlined,
 * because a base64 PDF in a JSON file helps nobody; they stay downloadable one
 * by one through the existing authorised route.
 */

export interface ExportBundle {
  exportedAt: string;
  format: string;
  account: unknown;
  [key: string]: unknown;
}

export async function buildExport(userId: string): Promise<ExportBundle> {
  const [
    user,
    subjects,
    lectures,
    availability,
    sessions,
    assignments,
    exams,
    grades,
    goals,
    materials,
    notes,
    flashcards,
    quizAttempts,
    conversations,
    memberships,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, settings: true, preference: true },
    }),
    db.subject.findMany({
      where: { userId },
      include: { topics: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.lecture.findMany({ where: { userId } }),
    db.availability.findMany({ where: { userId } }),
    db.studySession.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { start: "asc" }],
    }),
    db.assignment.findMany({
      where: { userId },
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { due: "asc" },
    }),
    db.exam.findMany({
      where: { userId },
      include: { topics: true },
      orderBy: { date: "asc" },
    }),
    db.grade.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.studyGoal.findMany({ where: { userId } }),
    db.material.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.note.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.flashcard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.quizAttempt.findMany({
      where: { userId },
      include: { answers: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.aIConversation.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.studySpaceMember.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true, about: true } } },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "hajdemsojna/export@1",

    account: {
      email: user.email,
      name: user.name,
      surname: user.surname,
      createdAt: user.createdAt,
      profile: user.profile && {
        learnerType: user.profile.learnerType,
        institution: user.profile.institution,
        year: user.profile.year,
        streak: user.profile.streak,
        onboardedAt: user.profile.onboardedAt,
      },
      settings: user.settings && {
        theme: user.settings.theme,
        language: user.settings.language,
        aiProvider: user.settings.aiProvider,
        aiModel: user.settings.aiModel,
        aiCreativity: user.settings.aiCreativity,
        shareStatus: user.settings.shareStatus,
        shareSchedule: user.settings.shareSchedule,
        shareProgress: user.settings.shareProgress,
        shareGrades: user.settings.shareGrades,
      },
      preference: user.preference && {
        sessionLength: user.preference.sessionLength,
        breakLength: user.preference.breakLength,
        maxMinutesPerDay: user.preference.maxMinutesPerDay,
        rhythm: user.preference.rhythm,
        freeDays: user.preference.freeDays,
      },
    },

    subjects,
    lectures,
    availability,
    studySessions: sessions,
    assignments,
    exams,
    grades,
    goals: goals.map((g) => g.key),
    notes,
    flashcards,
    quizAttempts,
    aiConversations: conversations,
    studyGroups: memberships.map((m) => ({
      ...m.group,
      role: m.role,
      joinedAt: m.joinedAt,
    })),

    // Files themselves are downloaded separately; this is the manifest.
    materials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      kind: m.kind,
      subjectId: m.subjectId,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      url: m.url,
      summary: m.summary,
      createdAt: m.createdAt,
      hasFile: Boolean(m.storageKey),
    })),
  };
}

/* ============================================================
   Calendar
   ============================================================ */

/**
 * Escapes a value for an iCalendar property, per RFC 5545 section 3.3.11.
 * Backslash first, or it would escape the escapes added after it.
 */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Lines must be at most 75 octets, continued with a leading space. Folding on
 * characters rather than octets is a deliberate simplification: Albanian text
 * is 2-byte UTF-8 at worst, so a 70-character limit stays inside 75 octets.
 */
function fold(line: string): string {
  if (line.length <= 70) return line;
  const parts = [line.slice(0, 70)];
  let rest = line.slice(70);
  while (rest.length > 69) {
    parts.push(` ${rest.slice(0, 69)}`);
    rest = rest.slice(69);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function isoOf(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function hhmmOf(mins: number): string {
  const h = `${Math.floor(mins / 60)}`.padStart(2, "0");
  const m = `${mins % 60}`.padStart(2, "0");
  return `${h}:${m}`;
}

/** "2026-09-17" plus "14:30" becomes "20260917T143000" (floating local time). */
function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

/** Adds minutes to a local date/time, rolling the date over when it passes midnight. */
function addMinutesTo(date: string, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;

  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + dayShift);

  return { date: isoOf(d), time: hhmmOf(mins) };
}

/** The next date on or after `from` that falls on Monday-first index `day`. */
function nextWeekday(from: string, day: number): string {
  const d = new Date(`${from}T00:00:00`);
  const current = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + ((day - current + 7) % 7));
  return isoOf(d);
}

function lectureKindLabel(kind: string): string {
  switch (kind) {
    case "ushtrime":
      return "Ushtrime";
    case "lab":
      return "Laborator";
    case "seminar":
      return "Seminar";
    default:
      return "Ligjëratë";
  }
}

/**
 * The student's schedule as an .ics file.
 *
 * Times are written as floating local time with no timezone, which is correct
 * here: a lecture at 09:00 is at 09:00 wherever the student's phone thinks it
 * is, and the app already stores everything in their own local terms.
 *
 * Lectures become weekly recurring events; study sessions and exams are
 * one-offs. Deadlines are all-day events, because an assignment is due on a
 * day rather than at a minute.
 */
export async function buildCalendar(
  userId: string,
  today: string
): Promise<string> {
  const [lectures, sessions, exams, assignments] = await Promise.all([
    db.lecture.findMany({ where: { userId }, include: { subject: true } }),
    db.studySession.findMany({
      where: { userId, date: { gte: today }, status: { not: "skipped" } },
      include: { subject: true },
    }),
    db.exam.findMany({ where: { userId }, include: { subject: true } }),
    db.assignment.findMany({
      where: { userId, done: false },
      include: { subject: true },
    }),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hajde Msojna//Orari//SQ",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Hajde Msojna",
  ];

  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const push = (uid: string, parts: string[]) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@hajdemsojna`,
      `DTSTAMP:${now}`,
      ...parts,
      "END:VEVENT"
    );
  };

  // Lectures repeat weekly. The first occurrence is the next matching weekday
  // on or after today, so the series does not begin in the past.
  const WEEKDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  for (const lecture of lectures) {
    const start = nextWeekday(today, lecture.day);

    push(`lecture-${lecture.id}`, [
      `DTSTART:${stamp(start, lecture.start)}`,
      `DTEND:${stamp(start, lecture.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAY[lecture.day]}`,
      fold(`SUMMARY:${esc(lecture.subject.name)}`),
      fold(`DESCRIPTION:${esc(lectureKindLabel(lecture.kind))}`),
      ...(lecture.room ? [fold(`LOCATION:${esc(lecture.room)}`)] : []),
    ]);
  }

  for (const session of sessions) {
    const end = addMinutesTo(session.date, session.start, session.minutes);
    push(`session-${session.id}`, [
      `DTSTART:${stamp(session.date, session.start)}`,
      `DTEND:${stamp(end.date, end.time)}`,
      fold(`SUMMARY:${esc(session.title)}`),
      fold(
        `DESCRIPTION:${esc(
          [session.subject?.name, session.objective, session.why]
            .filter(Boolean)
            .join(" - ")
        )}`
      ),
    ]);
  }

  for (const exam of exams) {
    const end = addMinutesTo(exam.date, exam.start, 120);
    push(`exam-${exam.id}`, [
      `DTSTART:${stamp(exam.date, exam.start)}`,
      `DTEND:${stamp(end.date, end.time)}`,
      fold(`SUMMARY:${esc(`${exam.subject.name} - ${exam.title}`)}`),
      ...(exam.room ? [fold(`LOCATION:${esc(exam.room)}`)] : []),
      // Exams are the one thing here worth an alarm the day before.
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(`Nesër: ${exam.subject.name}`)}`),
      "END:VALARM",
    ]);
  }

  for (const assignment of assignments) {
    const next = addMinutesTo(assignment.due, "00:00", 1440);
    push(`assignment-${assignment.id}`, [
      `DTSTART;VALUE=DATE:${assignment.due.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${next.date.replace(/-/g, "")}`,
      fold(`SUMMARY:${esc(`Afat: ${assignment.title}`)}`),
      fold(
        `DESCRIPTION:${esc(
          `${assignment.subject.name} · ${assignment.progress}% e përfunduar`
        )}`
      ),
    ]);
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}
