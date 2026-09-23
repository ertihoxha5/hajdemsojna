import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, enforceRateLimit, handle, jsonError } from "@/lib/api";
import { publish } from "@/server/realtime";
import { reactionInput, roomMessageInput } from "@/lib/spaces/validation";
import { SpaceError, requireMember } from "@/server/spaces";
import { groupAssistantReply } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MessageWire {
  id: string;
  userId: string | null;
  authorName: string;
  text: string;
  isAI: boolean;
  kind: string;
  replyToId: string | null;
  pinned: boolean;
  at: string;
}

function wire(m: {
  id: string;
  userId: string | null;
  authorName: string;
  text: string;
  isAI: boolean;
  kind: string;
  replyToId: string | null;
  pinned: boolean;
  createdAt: Date;
}): MessageWire {
  return {
    id: m.id,
    userId: m.userId,
    authorName: m.authorName,
    text: m.text,
    isAI: m.isAI,
    kind: m.kind,
    replyToId: m.replyToId,
    pinned: m.pinned,
    at: m.createdAt.toISOString(),
  };
}

export async function GET(
  request: Request,
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

    const before = new URL(request.url).searchParams.get("before");

    const rows = await db.roomMessage.findMany({
      where: {
        groupId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    return NextResponse.json({
      ok: true,
      messages: rows.reverse().map(wire),
    });
  });
}

/**
 * Posts a message.
 *
 * Mentioning @AI calls the model server-side and stores the answer as a normal
 * message, so everyone in the room sees the same reply and it survives a
 * reload — rather than living only in the asker's browser.
 */
export async function POST(
  request: Request,
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

    const limited = enforceRateLimit(user.id, "roomMessage");
    if (limited) return limited;

    const parsed = roomMessageInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? ERRORS.invalid,
        400,
        "invalid_input"
      );
    }

    // A reply must point at a message in this same room.
    let replyToId: string | null = null;
    if (parsed.data.replyToId) {
      const target = await db.roomMessage.findFirst({
        where: { id: parsed.data.replyToId, groupId: id },
        select: { id: true },
      });
      replyToId = target?.id ?? null;
    }

    const posted = await db.roomMessage.create({
      data: {
        groupId: id,
        userId: user.id,
        authorName: user.name,
        text: parsed.data.text,
        replyToId,
      },
    });

    publish(id, { type: "message", message: wire(posted) });

    const mentionsAI = /@ai\b/i.test(parsed.data.text);
    if (!mentionsAI) {
      return NextResponse.json({ ok: true, message: wire(posted) });
    }

    const space = await db.studySpace.findUnique({
      where: { id },
      select: { aiSupervisor: true, subjectName: true, name: true },
    });
    if (!space?.aiSupervisor) {
      return NextResponse.json({ ok: true, message: wire(posted) });
    }

    const aiLimited = enforceRateLimit(user.id, "roomAI");
    if (aiLimited) return aiLimited;

    // The answer is produced and stored here rather than streamed, because it
    // belongs to the room: everyone must end up with the same text.
    let answer: string;
    try {
      const recent = await db.roomMessage.findMany({
        where: { groupId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { authorName: true, text: true },
      });

      answer = await groupAssistantReply(user.id, {
        groupName: space.name,
        subject: space.subjectName,
        question: parsed.data.text.replace(/@ai\b/i, "").trim(),
        transcript: recent
          .reverse()
          .map((m) => `${m.authorName}: ${m.text}`)
          .join("\n"),
      });
    } catch (error) {
      const message =
        error instanceof AIError ? error.message : ERRORS.aiUnavailable;
      if (!(error instanceof AIError)) console.error("[spaces/ai]", error);

      const failed = await db.roomMessage.create({
        data: {
          groupId: id,
          authorName: "Mso AI",
          text: message,
          isAI: true,
          kind: "system",
        },
      });
      publish(id, { type: "message", message: wire(failed) });
      return NextResponse.json({ ok: true, message: wire(posted) });
    }

    const reply = await db.roomMessage.create({
      data: {
        groupId: id,
        authorName: "Mso AI",
        text: answer,
        isAI: true,
      },
    });
    publish(id, { type: "message", message: wire(reply) });

    return NextResponse.json({ ok: true, message: wire(posted) });
  });
}

/** A tiny reaction, broadcast but never stored — it is a wave, not a record. */
export async function PUT(
  request: Request,
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

    const limited = enforceRateLimit(user.id, "roomMessage");
    if (limited) return limited;

    const parsed = reactionInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    publish(id, { type: "reaction", userId: user.id, emoji: parsed.data.emoji });
    return NextResponse.json({ ok: true });
  });
}
