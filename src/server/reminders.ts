import "server-only";
import { db } from "@/lib/db";
import { addDays, daysBetween, relativeDays } from "@/lib/date";

/**
 * Deadline and exam reminders.
 *
 * Before this, the Notification table was written only when a plan was
 * generated or a friend request arrived — so the one thing a student actually
 * needs telling, that something is due tomorrow, was never said.
 *
 * Two rules keep this from becoming noise:
 *
 *   1. Every notification has a deterministic key embedded in its title check,
 *      so running this twice in a day cannot produce duplicates. It is
 *      idempotent by construction rather than by remembering when it last ran.
 *   2. Nothing is generated for work already finished. An assignment at 100%
 *      is not a deadline, it is a formality.
 *
 * It runs on state load rather than on a scheduler, because this app has no
 * background worker: the student's own visit is the trigger. That means
 * reminders appear when they open the app, which is the only moment they could
 * act on them anyway.
 */

/** How many days ahead each kind of thing is worth mentioning. */
const ASSIGNMENT_HORIZON = 2;
const EXAM_HORIZON = 3;

export async function generateReminders(
  userId: string,
  today: string
): Promise<void> {
  const horizon = addDays(today, Math.max(ASSIGNMENT_HORIZON, EXAM_HORIZON));

  const [assignments, exams, existing] = await Promise.all([
    db.assignment.findMany({
      where: {
        userId,
        done: false,
        due: { gte: today, lte: addDays(today, ASSIGNMENT_HORIZON) },
      },
      include: { subject: { select: { name: true } } },
    }),
    db.exam.findMany({
      where: { userId, date: { gte: today, lte: horizon } },
      include: { subject: { select: { name: true } } },
    }),
    // Today's notifications only: the same deadline should be mentioned again
    // tomorrow, when it is more urgent, but not twice in one day.
    db.notification.findMany({
      where: { userId, createdAt: { gte: new Date(`${today}T00:00:00`) } },
      select: { title: true },
    }),
  ]);

  const already = new Set(existing.map((n) => n.title));
  const fresh: { title: string; body: string; tone: string }[] = [];

  for (const assignment of assignments) {
    const days = daysBetween(today, assignment.due);
    const title = `Afat: ${assignment.title}`;
    if (already.has(title)) continue;

    fresh.push({
      title,
      body: `${assignment.subject.name} — skadon ${relativeDays(today, assignment.due)}. ${
        assignment.progress > 0
          ? `Je ${assignment.progress}% i gatshëm.`
          : "Nuk ke filluar ende."
      }`,
      tone: days === 0 ? "warn" : "info",
    });
  }

  for (const exam of exams) {
    const days = daysBetween(today, exam.date);
    const title = `Provim: ${exam.subject.name}`;
    if (already.has(title)) continue;

    fresh.push({
      title,
      body: `${exam.title} — ${relativeDays(today, exam.date)} në ${exam.start}${
        exam.room ? `, salla ${exam.room}` : ""
      }.`,
      tone: days <= 1 ? "warn" : "info",
    });
  }

  if (!fresh.length) return;

  await db.notification.createMany({
    data: fresh.map((n) => ({ ...n, userId })),
  });
}
