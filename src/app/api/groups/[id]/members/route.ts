import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isOnline, requireMembership, touchPresence } from "@/server/groups";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Current roster with live presence. Also acts as this member's heartbeat. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireMembership(id, user.id);
    await touchPresence(id, user.id);

    const group = await db.studySpace.findUniqueOrThrow({
      where: { id },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

    return NextResponse.json({
      inviteCode: group.ownerId === user.id ? group.inviteCode : undefined,
      members: group.members.map((m) => ({
        id: m.userId === user.id ? "me" : m.userId,
        name: m.userId === user.id ? "Ti" : m.user.name,
        initials: `${m.user.name[0] ?? "?"}${m.user.surname[0] ?? ""}`.toUpperCase(),
        tone: m.user.profile?.avatarTone ?? 0,
        role: m.role,
        state: isOnline(m.lastSeen) ? m.state : "offline",
      })),
    });
  });
}

/** Leave the group. The owner leaving hands the room to the next member. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const member = await requireMembership(id, user.id);

    await db.studySpaceMember.delete({ where: { id: member.id } });

    if (member.role === "owner") {
      const next = await db.studySpaceMember.findFirst({
        where: { groupId: id },
        orderBy: { joinedAt: "asc" },
      });
      if (next) {
        await db.studySpaceMember.update({ where: { id: next.id }, data: { role: "owner" } });
        await db.studySpace.update({ where: { id }, data: { ownerId: next.userId } });
      } else {
        await db.studySpace.delete({ where: { id } });
        return NextResponse.json({ ok: true, deleted: true });
      }
    }

    await db.roomMessage.create({
      data: {
        groupId: id,
        authorName: "Sistemi",
        text: `${user.name} u largua nga grupi.`,
        kind: "system",
      },
    });

    return NextResponse.json({ ok: true });
  });
}
