import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { requireMembership } from "@/server/groups";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { clockTime, isoDate } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Scheduled group sessions.
 *
 * The GroupSession table and the group focus timer that reads it both already
 * existed; what was missing was any way to put a row in, so the timer always
 * fell back to a topicless 45 minutes. Any member can schedule — a study group
 * where only the owner may propose a time is not how students actually use one.
 */

const bodySchema = z.object({
  topic: z.string().trim().min(1, "Tema mungon").max(160),
  date: isoDate,
  start: clockTime,
  minutes: z.number().int().min(10).max(300).default(45),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireMembership(id, user.id);

    const today = await getToday();

    return NextResponse.json({
      ok: true,
      sessions: await db.groupSession.findMany({
        where: { groupId: id, date: { gte: today } },
        orderBy: [{ date: "asc" }, { start: "asc" }],
      }),
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireMembership(id, user.id);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const session = await db.groupSession.create({
      data: { groupId: id, ...parsed.data },
    });

    // Everyone sees it in the feed, so nobody has to be told separately.
    await db.groupMessage.create({
      data: {
        groupId: id,
        userId: user.id,
        authorName: user.name,
        kind: "system",
        text: `${user.name} planifikoi një sesion: ${session.topic} — ${session.date} në ${session.start}.`,
      },
    });

    return NextResponse.json({ ok: true, session });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireMembership(id, user.id);

    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) return jsonError(ERRORS.invalid, 400, "invalid_input");

    // Scoped by groupId as well as id, so a session id from another room
    // matches nothing.
    await db.groupSession.deleteMany({ where: { id: sessionId, groupId: id } });

    return NextResponse.json({ ok: true });
  });
}
