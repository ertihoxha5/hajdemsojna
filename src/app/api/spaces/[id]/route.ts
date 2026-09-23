import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { publish } from "@/server/realtime";
import { spaceSettingsInput } from "@/lib/spaces/validation";
import {
  SpaceError,
  broadcastPresence,
  currentSession,
  listMembers,
  requireHost,
  requireMember,
  spaceWire,
} from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The full room state, for the first render. */
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

    const space = await db.studySpace.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!space) return jsonError(ERRORS.notFound, 404, "not_found");

    return NextResponse.json({
      ok: true,
      space: spaceWire(space, {
        memberCount: space._count.members,
        includeCode: true,
      }),
      members: await listMembers(id, user.id),
      session: await currentSession(id),
    });
  });
}

/** Host-only room settings. */
export async function PATCH(
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

    const parsed = spaceSettingsInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const space = await db.studySpace.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { members: true } } },
    });

    const wire = spaceWire(space, {
      memberCount: space._count.members,
      includeCode: true,
    });
    publish(id, { type: "space", space: wire });

    return NextResponse.json({ ok: true, space: wire });
  });
}

/** Leaving. An owner who leaves hands the room to the next member. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const member = await db.studySpaceMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
      select: { role: true },
    });
    if (!member) return NextResponse.json({ ok: true });

    await db.studySpaceMember.deleteMany({
      where: { groupId: id, userId: user.id },
    });

    if (member.role === "owner") {
      const next = await db.studySpaceMember.findFirst({
        where: { groupId: id },
        orderBy: { joinedAt: "asc" },
      });

      if (next) {
        await db.studySpaceMember.update({
          where: { id: next.id },
          data: { role: "owner" },
        });
        await db.studySpace.update({
          where: { id },
          data: { ownerId: next.userId },
        });
      } else {
        // Last one out: the room goes with them rather than lingering empty.
        await db.studySpace.delete({ where: { id } });
        return NextResponse.json({ ok: true, deleted: true });
      }
    }

    await broadcastPresence(id);
    return NextResponse.json({ ok: true });
  });
}
