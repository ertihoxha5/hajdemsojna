import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { quizAttemptInput } from "@/lib/validation";
import { getQuizAttempt, listQuizAttempts, recordQuizAttempt } from "@/server/recall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stores a finished quiz so that a score means something a week later.
 *
 * The score is recomputed server-side from the answers; the client's own idea
 * of how well it did is not trusted.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();

    const parsed = quizAttemptInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const result = await recordQuizAttempt(user.id, today, {
      subjectId: parsed.data.subjectId ?? null,
      materialId: parsed.data.materialId ?? null,
      source: parsed.data.source,
      seconds: parsed.data.seconds,
      answers: parsed.data.answers,
    });

    return NextResponse.json({ ok: true, ...result });
  });
}

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(request.url);

    const id = url.searchParams.get("id");
    if (id) {
      const attempt = await getQuizAttempt(user.id, id);
      if (!attempt) return jsonError(ERRORS.notFound, 404, "not_found");
      return NextResponse.json({ ok: true, attempt });
    }

    return NextResponse.json({
      ok: true,
      attempts: await listQuizAttempts(user.id, {
        subjectId: url.searchParams.get("subjectId") ?? undefined,
      }),
    });
  });
}
