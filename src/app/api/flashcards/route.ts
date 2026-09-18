import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { flashcardInput } from "@/lib/validation";
import {
  createCards,
  deleteCard,
  dueQueue,
  listCards,
  recallSummary,
  setCardSuspended,
} from "@/server/recall";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The student's own deck. Nothing here calls the model — cards are plain rows,
 * and the scheduling is arithmetic, so this route stays free and instant.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();

    const url = new URL(request.url);
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    const scope = url.searchParams.get("scope");

    const [cards, summary] = await Promise.all([
      scope === "due"
        ? dueQueue(user.id, today, { subjectId })
        : listCards(user.id, { subjectId }),
      recallSummary(user.id, today),
    ]);

    return NextResponse.json({ ok: true, cards, summary, today });
  });
}

const createSchema = z.object({
  cards: z.array(flashcardInput).min(1).max(50),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();

    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const cards = await createCards(
      user.id,
      today,
      parsed.data.cards.map((c) => ({ ...c, source: "manual" }))
    );

    return NextResponse.json({ ok: true, cards });
  });
}

const patchSchema = z.object({
  cardId: z.string().min(1),
  suspended: z.boolean(),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    await setCardSuspended(user.id, parsed.data.cardId, parsed.data.suspended);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const cardId = new URL(request.url).searchParams.get("id");
    if (!cardId) return jsonError(ERRORS.invalid, 400, "invalid_input");

    await deleteCard(user.id, cardId);
    return NextResponse.json({ ok: true });
  });
}
