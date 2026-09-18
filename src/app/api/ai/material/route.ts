import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { analyseMaterial, type MaterialAction } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  materialId: z.string().min(1),
  action: z.enum(["summarize", "key-concepts", "explain", "flashcards", "exam-questions"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "material");
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const material = await db.material.findFirst({
      where: { id: parsed.data.materialId, userId: user.id },
    });
    if (!material) return jsonError(ERRORS.notFound, 404, "not_found");

    if (!material.extracted) {
      return jsonError(
        "Nuk u lexua tekst nga ky material. Provo me një PDF me tekst ose një skedar TXT.",
        422,
        "no_text"
      );
    }

    const text = await analyseMaterial(user.id, parsed.data.action as MaterialAction, {
      title: material.title,
      text: material.extracted,
    });

    // The summary is worth keeping; the rest are one-off answers.
    if (parsed.data.action === "summarize") {
      await db.material.update({ where: { id: material.id }, data: { summary: text } });
    }

    return NextResponse.json({ ok: true, text });
  } catch (error) {
    if (error instanceof AIError) return jsonError(error.message, error.status, error.code);
    console.error("[ai/material]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
