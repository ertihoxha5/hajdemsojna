import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { generateFlashcards } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";
import { flashcardGenerateInput } from "@/lib/validation";
import { createCards, recallSummary } from "@/server/recall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Turns a subject, a set of topics, or an uploaded material into cards the
 * student then owns outright.
 *
 * The model's output is matched back to the student's real topics by name
 * before anything is stored, so a card can only ever be filed under a topic
 * that actually exists — the same rule the study planner follows.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "material");
    if (limited) return limited;

    const parsed = flashcardGenerateInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const subject = await db.subject.findFirst({
      where: { id: parsed.data.subjectId, userId: user.id },
      include: { topics: true },
    });
    if (!subject) return jsonError(ERRORS.notFound, 404, "not_found");

    const selected = parsed.data.topicIds?.length
      ? subject.topics.filter((t) => parsed.data.topicIds!.includes(t.id))
      : subject.topics.filter((t) => t.mastery <= 2);
    const topics = selected.length ? selected : subject.topics;

    let sourceText: string | undefined;
    if (parsed.data.materialId) {
      const material = await db.material.findFirst({
        where: { id: parsed.data.materialId, userId: user.id },
        select: { extracted: true },
      });
      sourceText = material?.extracted ?? undefined;
    }

    const generated = await generateFlashcards(user.id, {
      subject: subject.name,
      topics: topics.map((t) => t.name),
      count: parsed.data.count ?? 10,
      sourceText,
    });

    // Match the model's topic names back to real rows. Anything unrecognised
    // becomes a subject-level card rather than being dropped or invented.
    const byName = new Map(
      subject.topics.map((t) => [t.name.trim().toLowerCase(), t.id])
    );

    const today = await getToday();
    const cards = await createCards(
      user.id,
      today,
      generated.cards.map((c) => ({
        front: c.front,
        back: c.back,
        subjectId: subject.id,
        topicId: byName.get(c.topic.trim().toLowerCase()) ?? null,
        source: parsed.data.materialId ? "material" : "ai",
        materialId: parsed.data.materialId ?? null,
      }))
    );

    return NextResponse.json({
      ok: true,
      cards,
      summary: await recallSummary(user.id, today),
    });
  } catch (error) {
    if (error instanceof AIError) return jsonError(error.message, error.status, error.code);
    console.error("[flashcards/generate]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
