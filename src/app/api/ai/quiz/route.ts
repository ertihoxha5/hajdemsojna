import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateQuiz } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  subjectId: z.string().min(1),
  count: z.number().int().min(1).max(15).optional(),
  topicIds: z.array(z.string()).optional(),
  materialId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "quiz");
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const subject = await db.subject.findFirst({
      where: { id: parsed.data.subjectId, userId: user.id },
      include: { topics: true },
    });
    if (!subject) return jsonError(ERRORS.notFound, 404, "not_found");

    const topics = parsed.data.topicIds?.length
      ? subject.topics.filter((t) => parsed.data.topicIds!.includes(t.id))
      : subject.topics.filter((t) => t.mastery <= 2);

    let sourceText: string | undefined;
    if (parsed.data.materialId) {
      const material = await db.material.findFirst({
        where: { id: parsed.data.materialId, userId: user.id },
        select: { extracted: true },
      });
      sourceText = material?.extracted ?? undefined;
    }

    const quiz = await generateQuiz(user.id, {
      subject: subject.name,
      topics: (topics.length ? topics : subject.topics).map((t) => t.name),
      count: parsed.data.count ?? 5,
      sourceText,
    });

    return NextResponse.json({ ok: true, questions: quiz.questions });
  } catch (error) {
    if (error instanceof AIError) return jsonError(error.message, error.status, error.code);
    console.error("[ai/quiz]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
