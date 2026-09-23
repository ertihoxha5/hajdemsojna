import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ code: z.string().trim().min(4).max(12) });

/** Joins a group by invite code. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const group = await db.studySpace.findUnique({
      where: { inviteCode: parsed.data.code.toUpperCase() },
    });
    if (!group) return jsonError("Kodi i ftesës nuk u gjet.", 404, "not_found");

    const existing = await db.studySpaceMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
    });

    if (!existing) {
      await db.studySpaceMember.create({
        data: { groupId: group.id, userId: user.id, state: "meson", lastSeen: new Date() },
      });
      await db.roomMessage.create({
        data: {
          groupId: group.id,
          authorName: "Sistemi",
          text: `${user.name} u bashkua në grup.`,
          kind: "system",
        },
      });
    }

    return NextResponse.json({ ok: true, id: group.id });
  });
}
