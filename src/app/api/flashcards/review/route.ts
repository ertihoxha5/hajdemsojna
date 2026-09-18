import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { flashcardReviewInput } from "@/lib/validation";
import { recallSummary, reviewCard } from "@/server/recall";
import { intervalLabel } from "@/lib/srs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records one answered card.
 *
 * Deliberately not rate limited: it costs one small write, and a student on a
 * good run should never be told to slow down.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();

    const parsed = flashcardReviewInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const outcome = await reviewCard(
      user.id,
      today,
      parsed.data.cardId,
      parsed.data.recall
    );
    if (!outcome) return jsonError(ERRORS.notFound, 404, "not_found");

    return NextResponse.json({
      ok: true,
      card: outcome.card,
      lapsed: outcome.lapsed,
      nextLabel: intervalLabel(outcome.intervalDays),
      summary: await recallSummary(user.id, today),
    });
  });
}
