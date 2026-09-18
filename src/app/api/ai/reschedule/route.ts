import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { suggestReschedule } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { addDays, dayIndex, minutesOf } from "@/lib/date";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ sessionId: z.string().min(1) });

/**
 * Asks the model for a better time for a missed session, then checks the
 * suggestion against the student's free windows and lectures before moving it.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "reschedule");
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const today = await getToday();
    const session = await db.studySession.findFirst({
      where: { id: parsed.data.sessionId, userId: user.id },
      include: { subject: true },
    });
    if (!session) return jsonError(ERRORS.notFound, 404, "not_found");

    const horizon = addDays(today, 14);
    const [others, lectures, windows] = await Promise.all([
      db.studySession.findMany({
        where: {
          userId: user.id,
          status: "planned",
          date: { gte: today, lte: horizon },
          NOT: { id: session.id },
        },
      }),
      db.lecture.findMany({ where: { userId: user.id } }),
      db.availability.findMany({ where: { userId: user.id } }),
    ]);

    const suggestion = await suggestReschedule(
      user.id,
      today,
      {
        subject: session.subject?.name ?? "",
        title: session.title,
        minutes: session.minutes,
      },
      others.map((s) => `${s.date} ${s.start}–${s.minutes}min`)
    );

    const day = dayIndex(suggestion.date);
    const start = minutesOf(suggestion.startTime);
    const end = start + session.minutes;

    const insideWindow = windows.some(
      (w) => w.day === day && start >= minutesOf(w.fromTime) && end <= minutesOf(w.toTime)
    );
    const clashesLecture = lectures.some(
      (l) => l.day === day && start < minutesOf(l.end) && end > minutesOf(l.start)
    );
    const clashesSession = others.some(
      (o) =>
        o.date === suggestion.date &&
        start < minutesOf(o.start) + o.minutes &&
        end > minutesOf(o.start)
    );

    if (
      suggestion.date < today ||
      suggestion.date > horizon ||
      !insideWindow ||
      clashesLecture ||
      clashesSession
    ) {
      return jsonError(
        "AI nuk gjeti një term që përshtatet. Zgjedh kohën vetë.",
        422,
        "no_valid_slot"
      );
    }

    await db.studySession.update({
      where: { id: session.id },
      data: {
        date: suggestion.date,
        start: suggestion.startTime,
        status: "planned",
        why: suggestion.reason || "I riplanifikuar nga AI.",
        source: "ai",
      },
    });

    return NextResponse.json({ ok: true, ...suggestion });
  } catch (error) {
    if (error instanceof AIError) return jsonError(error.message, error.status, error.code);
    console.error("[ai/reschedule]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
