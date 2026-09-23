import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { publish } from "@/server/realtime";
import {
  heartbeatInput,
  moveInput,
  studyStatusInput,
} from "@/lib/spaces/validation";
import { environmentFor } from "@/lib/spaces/environments";
import {
  SpaceError,
  broadcastPresence,
  heartbeat,
  requireMember,
} from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resolves membership, returning the error rather than throwing it. */
async function member(id: string, userId: string) {
  try {
    return await requireMember(id, userId);
  } catch (error) {
    if (error instanceof SpaceError) return error;
    throw error;
  }
}

/**
 * The heartbeat.
 *
 * Deliberately cheap: one row update and no broadcast. Presence reaches the
 * room through the roster the stream pushes when something actually changes,
 * so a heartbeat costs a single write rather than a fan-out to everyone.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const m = await member(id, user.id);
    if (m instanceof SpaceError) return jsonError(m.message, m.status, m.code);

    const parsed = heartbeatInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    await heartbeat(id, user.id, parsed.data);
    return NextResponse.json({ ok: true });
  });
}

/** Movement and seating. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const m = await member(id, user.id);
    if (m instanceof SpaceError) return jsonError(m.message, m.status, m.code);

    const parsed = moveInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const space = await db.studySpace.findUnique({
      where: { id },
      select: { environment: true },
    });
    if (!space) return jsonError(ERRORS.notFound, 404, "not_found");

    // The destination is clamped to the real map rather than trusted: a
    // forged body should not put an avatar outside the room.
    const env = environmentFor(space.environment);
    const x = Math.min(env.cols - 1, Math.max(0, parsed.data.x));
    const y = Math.min(env.rows - 1, Math.max(0, parsed.data.y));

    // A seat id must name a real seat here, and one already occupied is
    // refused rather than quietly shared by two avatars.
    let seatId: string | null = null;
    if (parsed.data.seatId) {
      const seat = env.seats.find((s) => s.id === parsed.data.seatId);
      if (seat) {
        const taken = await db.studySpaceMember.findFirst({
          where: { groupId: id, seatId: seat.id, NOT: { userId: user.id } },
          select: { id: true },
        });
        if (taken) {
          return jsonError("Kjo karrige është e zënë.", 409, "seat_taken");
        }
        seatId = seat.id;
      }
    }

    await db.studySpaceMember.updateMany({
      where: { groupId: id, userId: user.id },
      data: {
        avatarX: x,
        avatarY: y,
        seatId,
        lastActiveAt: new Date(),
        lastSeen: new Date(),
      },
    });

    // Movement gets its own small event. It is the most frequent message in
    // the room, so sending the whole roster on every step would be wasteful.
    publish(id, { type: "move", userId: user.id, x, y, seatId });

    return NextResponse.json({ ok: true, x, y, seatId });
  });
}

/** What the student is working on, shown to the rest of the room. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const m = await member(id, user.id);
    if (m instanceof SpaceError) return jsonError(m.message, m.status, m.code);

    const parsed = studyStatusInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    await db.studySpaceMember.updateMany({
      where: { groupId: id, userId: user.id },
      data: { ...parsed.data, lastActiveAt: new Date() },
    });

    await broadcastPresence(id);
    return NextResponse.json({ ok: true });
  });
}
