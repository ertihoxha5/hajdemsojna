import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { generateStudyPlan } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { addDays, dayIndex, minutesOf } from "@/lib/date";
import { isoDate } from "@/lib/validation";
import { ERRORS, jsonError } from "@/lib/api";
import { newServerId } from "@/lib/id-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  from: isoDate.optional(),
  days: z.number().int().min(1).max(21).optional(),
  examId: z.string().optional(),
  assignmentId: z.string().optional(),
  replace: z.boolean().optional(),
});

/**
 * Generates a study plan with the model and stores it.
 *
 * The model's output is validated (Zod), then checked against the student's
 * real constraints — its subjects, its free windows, its lectures — before a
 * single row is written. Anything that doesn't fit is dropped rather than
 * trusted, so a hallucinated slot can never end up on the timetable.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return jsonError(ERRORS.unauthorized, 401, "unauthorized");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }

  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

  const today = await getToday();
  const from = parsed.data.from ?? today;
  const to = addDays(from, (parsed.data.days ?? 7) - 1);

  // Optional focus — only for a row this user owns.
  let focus;
  if (parsed.data.examId) {
    const exam = await db.exam.findFirst({
      where: { id: parsed.data.examId, userId: user.id },
      include: { subject: true },
    });
    if (exam) {
      focus = {
        kind: "exam" as const,
        id: exam.id,
        label: `Provimi ${exam.subject.name} — ${exam.title}, më ${exam.date}`,
      };
    }
  } else if (parsed.data.assignmentId) {
    const assignment = await db.assignment.findFirst({
      where: { id: parsed.data.assignmentId, userId: user.id },
      include: { subject: true },
    });
    if (assignment) {
      focus = {
        kind: "assignment" as const,
        id: assignment.id,
        label: `Detyra "${assignment.title}" (${assignment.subject.name}), afati ${assignment.due}`,
      };
    }
  }

  try {
    const { plan } = await generateStudyPlan(user.id, today, { from, to, focus });

    // ── Validate the plan against reality before storing it ──
    const [lectures, windows, pref, existing] = await Promise.all([
      db.lecture.findMany({ where: { userId: user.id } }),
      db.availability.findMany({ where: { userId: user.id } }),
      db.studyPreference.findUnique({ where: { userId: user.id } }),
      db.studySession.findMany({
        where: { userId: user.id, date: { gte: from, lte: to }, status: { not: "planned" } },
      }),
    ]);

    const freeDays = new Set(
      (pref?.freeDays ?? "").split(",").map((d) => Number(d)).filter(Number.isInteger)
    );
    const maxPerDay = pref?.maxMinutesPerDay ?? 180;
    const perDay = new Map<string, number>();
    for (const s of existing) {
      perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.minutes);
    }

    const accepted: typeof plan.sessions = [];
    const rejected: { topic: string; why: string }[] = [];

    for (const s of plan.sessions) {
      const day = dayIndex(s.date);
      const start = minutesOf(s.startTime);
      const end = start + s.duration;

      if (freeDays.has(day)) {
        rejected.push({ topic: s.topic, why: "ditë pushimi" });
        continue;
      }

      const dayWindows = windows.filter((w) => w.day === day);
      const insideWindow = dayWindows.some(
        (w) => start >= minutesOf(w.fromTime) && end <= minutesOf(w.toTime)
      );
      if (!insideWindow) {
        rejected.push({ topic: s.topic, why: "jashtë kohës së lirë" });
        continue;
      }

      const clashesLecture = lectures.some(
        (l) => l.day === day && start < minutesOf(l.end) && end > minutesOf(l.start)
      );
      if (clashesLecture) {
        rejected.push({ topic: s.topic, why: "përplaset me ligjëratë" });
        continue;
      }

      const clashesSession = accepted.some(
        (a) =>
          a.date === s.date &&
          start < minutesOf(a.startTime) + a.duration &&
          end > minutesOf(a.startTime)
      );
      if (clashesSession) {
        rejected.push({ topic: s.topic, why: "përplaset me një sesion tjetër" });
        continue;
      }

      const used = perDay.get(s.date) ?? 0;
      if (used + s.duration > maxPerDay) {
        rejected.push({ topic: s.topic, why: "kalon maksimumin ditor" });
        continue;
      }

      perDay.set(s.date, used + s.duration);
      accepted.push(s);
    }

    if (accepted.length === 0) {
      return jsonError(
        "AI nuk gjeti asnjë term që përshtatet me orarin tënd. Shto pak më shumë kohë të lirë te Cilësimet.",
        422,
        "no_valid_slots"
      );
    }

    await db.$transaction([
      // Only still-open sessions are replaced; completed history is untouched.
      db.studySession.deleteMany({
        where: { userId: user.id, date: { gte: from, lte: to }, status: "planned" },
      }),
      db.studySession.createMany({
        data: accepted.map((s) => ({
          id: newServerId("ses"),
          userId: user.id,
          subjectId: s.subjectId,
          kind: s.kind ?? "mesim",
          title: s.topic,
          objective: "",
          date: s.date,
          start: s.startTime,
          minutes: s.duration,
          status: "planned",
          why: s.reason,
          source: "ai",
        })),
      }),
    ]);

    await db.notification.create({
      data: {
        userId: user.id,
        title: "Plani i ri u krijua",
        body: `${accepted.length} sesione u planifikuan nga AI për javën.`,
        tone: "ai",
      },
    });

    return NextResponse.json({
      ok: true,
      created: accepted.length,
      rejected,
      summary: plan.summary ?? null,
    });
  } catch (error) {
    if (error instanceof AIError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[ai/study-plan]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
