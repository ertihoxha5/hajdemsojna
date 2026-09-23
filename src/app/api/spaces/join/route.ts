import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ERRORS, enforceRateLimit, handle, jsonError } from "@/lib/api";
import { joinByCodeInput } from "@/lib/spaces/validation";
import { SpaceError, findByInviteCode, joinSpace } from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Looks up a code without joining.
 *
 * Returns only what a join prompt needs — name, subject, capacity, rules — so
 * a guessed code cannot be used to read a room's contents.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireUser();

    const code = new URL(request.url).searchParams.get("code") ?? "";
    const parsed = joinByCodeInput.safeParse({ code });
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const space = await findByInviteCode(parsed.data.code);
    if (!space) return jsonError("Nuk u gjet asnjë hapësirë me këtë kod.", 404, "not_found");

    return NextResponse.json({ ok: true, space });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    // Codes are short; without a limit they could simply be enumerated.
    const limited = enforceRateLimit(user.id, "spaceJoin");
    if (limited) return limited;

    const parsed = joinByCodeInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const space = await findByInviteCode(parsed.data.code);
    if (!space) return jsonError("Nuk u gjet asnjë hapësirë me këtë kod.", 404, "not_found");

    try {
      await joinSpace(user.id, space.id, { code: parsed.data.code });
    } catch (error) {
      if (error instanceof SpaceError) {
        return jsonError(error.message, error.status, error.code);
      }
      throw error;
    }

    return NextResponse.json({ ok: true, spaceId: space.id });
  });
}
