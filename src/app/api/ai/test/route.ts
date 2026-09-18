import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { testConnection } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Makes one small real call so "Testo lidhjen" means something. */
export async function POST() {
  try {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "keyTest");
    if (limited) return limited;
    const result = await testConnection(user.id);
    return NextResponse.json({ ...result, message: "Lidhja me AI funksionon." });
  } catch (error) {
    if (error instanceof AIError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[ai/test]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }
}
