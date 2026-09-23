import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { memberCommandInput } from "@/lib/spaces/validation";
import {
  SpaceError,
  broadcastPresence,
  listMembers,
  requireHost,
  requireMember,
} from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    try {
      await requireMember(id, user.id);
    } catch (error) {
      if (error instanceof SpaceError) {
        return jsonError(error.message, error.status, error.code);
      }
      throw error;
    }

    return NextResponse.json({ ok: true, members: await listMembers(id, user.id) });
  });
}

/**
 * Host controls over a member.
 *
 * Note what is absent: there is no way for a host to switch on someone's
 * camera or microphone. Muting in a call is a request the other browser
 * honours, never something reached into from here.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    try {
      await requireHost(id, user.id);
    } catch (error) {
      if (error instanceof SpaceError) {
        return jsonError(error.message, error.status, error.code);
      }
      throw error;
    }

    const parsed = memberCommandInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const { userId: targetId, action } = parsed.data;

    const target = await db.studySpaceMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: targetId } },
      select: { id: true, role: true },
    });
    if (!target) return jsonError(ERRORS.notFound, 404, "not_found");

    // The owner is not removable or demotable by anyone, including a co-host.
    if (target.role === "owner") {
      return jsonError("Host-i nuk mund të hiqet.", 403, "owner_protected");
    }

    if (action === "kick") {
      await db.studySpaceMember.delete({ where: { id: target.id } });
    } else {
      await db.studySpaceMember.update({
        where: { id: target.id },
        data: { role: action === "promote" ? "cohost" : "member" },
      });
    }

    await broadcastPresence(id);
    return NextResponse.json({ ok: true });
  });
}
