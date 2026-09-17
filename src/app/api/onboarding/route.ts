import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { onboardingInput } from "@/lib/validation";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Writes everything the student entered during onboarding.
 *
 * Runs as one transaction: either the whole setup lands or none of it does, so
 * a failure halfway through can't leave a half-configured account. Subjects are
 * referenced by their position in the submitted array, then mapped to the real
 * ids once created.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = onboardingInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? ERRORS.invalid,
        400,
        "invalid_input"
      );
    }

    const input = parsed.data;

    await db.$transaction(async (tx) => {
      // Re-running onboarding replaces the previous setup rather than duplicating it.
      await tx.subject.deleteMany({ where: { userId: user.id } });
      await tx.availability.deleteMany({ where: { userId: user.id } });
      await tx.studyGoal.deleteMany({ where: { userId: user.id } });

      const created: string[] = [];
      for (const [i, s] of input.subjects.entries()) {
        const subject = await tx.subject.create({
          data: {
            userId: user.id,
            name: s.name,
            short: s.short || s.name.slice(0, 3).toUpperCase(),
            tone: s.tone ?? i % 5,
            teacher: s.teacher ?? "",
            room: s.room ?? "",
            difficulty: s.difficulty ?? 3,
            importance: s.importance ?? 3,
            targetGrade: s.targetGrade ?? 9,
            currentGrade: s.currentGrade ?? 0,
            credits: s.credits ?? 6,
          },
        });
        created.push(subject.id);
      }

      for (const l of input.lectures) {
        const subjectId = created[l.subjectIndex];
        if (!subjectId) continue;
        await tx.lecture.create({
          data: {
            userId: user.id,
            subjectId,
            day: l.day,
            start: l.start,
            end: l.end,
            kind: l.kind,
            room: l.room ?? "",
          },
        });
      }

      for (const e of input.exams) {
        const subjectId = created[e.subjectIndex];
        if (!subjectId) continue;
        await tx.exam.create({
          data: {
            userId: user.id,
            subjectId,
            title: e.title,
            kind: "kolokvium",
            date: e.date,
            start: e.start ?? "09:00",
          },
        });
      }

      for (const w of input.availability.windows) {
        await tx.availability.create({
          data: { userId: user.id, day: w.day, fromTime: w.from, toTime: w.to },
        });
      }

      await tx.studyPreference.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          sessionLength: input.availability.sessionLength ?? 45,
          breakLength: input.availability.breakLength ?? 15,
          maxMinutesPerDay: input.availability.maxMinutesPerDay ?? 180,
          rhythm: input.availability.rhythm ?? "fleksibil",
          freeDays: (input.availability.freeDays ?? []).join(","),
        },
        update: {
          sessionLength: input.availability.sessionLength ?? 45,
          breakLength: input.availability.breakLength ?? 15,
          maxMinutesPerDay: input.availability.maxMinutesPerDay ?? 180,
          rhythm: input.availability.rhythm ?? "fleksibil",
          freeDays: (input.availability.freeDays ?? []).join(","),
        },
      });

      for (const key of input.goals) {
        await tx.studyGoal.create({ data: { userId: user.id, key } });
      }

      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          learnerType: input.learnerType,
          institution: input.institution ?? "",
          year: input.year ?? "",
          onboardedAt: new Date(),
        },
        update: {
          learnerType: input.learnerType,
          institution: input.institution ?? "",
          year: input.year ?? "",
          onboardedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true });
  });
}
