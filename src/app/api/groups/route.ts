import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { groupInput } from "@/lib/validation";
import { makeInviteCode } from "@/server/groups";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Creates a group and makes the creator its owner and first member. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = groupInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? ERRORS.invalid, 400, "invalid_input");
    }

    const { name, about, subjectId } = parsed.data;

    const subject = subjectId
      ? await db.subject.findFirst({ where: { id: subjectId, userId: user.id } })
      : null;

    const group = await db.studySpace.create({
      data: {
        name,
        about: about ?? "",
        subjectId: subject?.id ?? null,
        subjectName: subject?.name ?? "",
        ownerId: user.id,
        inviteCode: makeInviteCode(),
        members: {
          create: { userId: user.id, role: "owner", state: "meson", lastSeen: new Date() },
        },
      },
    });

    await db.roomMessage.create({
      data: {
        groupId: group.id,
        authorName: "Sistemi",
        text: `${user.name} krijoi grupin.`,
        kind: "system",
      },
    });

    return NextResponse.json({ ok: true, id: group.id, inviteCode: group.inviteCode });
  });
}
