import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { enforceRateLimit, handle, jsonError } from "@/lib/api";
import { SpaceError, joinSpace } from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Joins a space by id, for the rooms where an id is enough: a public one, or
 * a friends-only one where the friendship does the vouching.
 *
 * No code is passed, so a private room refuses here by design — the caller
 * has to go through /api/spaces/join with the code.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const limited = enforceRateLimit(user.id, "spaceJoin");
    if (limited) return limited;

    try {
      await joinSpace(user.id, id);
    } catch (error) {
      if (error instanceof SpaceError) {
        return jsonError(error.message, error.status, error.code);
      }
      throw error;
    }

    return NextResponse.json({ ok: true, spaceId: id });
  });
}
