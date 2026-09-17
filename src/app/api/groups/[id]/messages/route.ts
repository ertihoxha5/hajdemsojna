import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { groupMessageInput } from "@/lib/validation";
import { requireMembership, touchPresence, toWire } from "@/server/groups";
import { groupAssistantReply, generateQuiz } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Message history, or just what arrived after `?after=<iso>`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireMembership(id, user.id);

    const after = new URL(request.url).searchParams.get("after");
    const messages = await db.groupMessage.findMany({
      where: {
        groupId: id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({ messages: messages.map((m) => toWire(m, user.id)) });
  });
}

/**
 * Posts a message. When it mentions @AI, the assistant answers as another
 * member of the room and its reply is stored like any other message, so
 * everyone sees it and it survives a reload.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const member = await requireMembership(id, user.id);
    await touchPresence(id, user.id);

    const parsed = groupMessageInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const text = parsed.data.text;

    const posted = await db.groupMessage.create({
      data: { groupId: id, userId: user.id, authorName: user.name, text },
    });

    const mentionsAI = /(^|\s)@ai\b/i.test(text);
    if (!mentionsAI) {
      return NextResponse.json({ ok: true, messages: [toWire(posted, user.id)] });
    }

    // ── The assistant is addressed ──
    const recent = await db.groupMessage.findMany({
      where: { groupId: id },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
    const transcript = recent
      .reverse()
      .filter((m) => m.kind !== "system")
      .map((m) => `${m.authorName}: ${m.text}`)
      .join("\n");

    const question = text.replace(/(^|\s)@ai\b/i, " ").trim();
    const wantsQuiz = /\b(kuiz|quiz|pyetje)\b/i.test(question);

    try {
      if (wantsQuiz && member.group.subjectId) {
        const count = Number(question.match(/\b(\d{1,2})\b/)?.[1] ?? 5);
        const quiz = await generateQuiz(user.id, {
          subject: member.group.subjectName || member.group.subject?.name || "",
          topics: [],
          count: Math.min(10, Math.max(3, count)),
        });

        const aiMessage = await db.groupMessage.create({
          data: {
            groupId: id,
            authorName: "Asistenti AI",
            text: "Ja një kuiz për grupin. Përgjigjuni secili para se t'i shihni përgjigjet e njëri-tjetrit.",
            isAI: true,
            kind: "quiz",
            payload: JSON.stringify({ questions: quiz.questions }),
          },
        });

        return NextResponse.json({
          ok: true,
          messages: [toWire(posted, user.id), toWire(aiMessage, user.id)],
        });
      }

      const reply = await groupAssistantReply(user.id, {
        groupName: member.group.name,
        subject: member.group.subjectName || member.group.subject?.name || "",
        transcript,
        question,
      });

      const aiMessage = await db.groupMessage.create({
        data: {
          groupId: id,
          authorName: "Asistenti AI",
          text: reply,
          isAI: true,
          kind: /\bplan\b/i.test(question) ? "plan" : "text",
        },
      });

      return NextResponse.json({
        ok: true,
        messages: [toWire(posted, user.id), toWire(aiMessage, user.id)],
      });
    } catch (error) {
      const message =
        error instanceof AIError ? error.message : ERRORS.aiUnavailable;
      if (!(error instanceof AIError)) console.error("[groups/messages ai]", error);

      // The student's message is already posted; say plainly that the
      // assistant could not answer rather than inventing a reply.
      const aiMessage = await db.groupMessage.create({
        data: {
          groupId: id,
          authorName: "Asistenti AI",
          text: message,
          isAI: true,
          kind: "system",
        },
      });

      return NextResponse.json({
        ok: true,
        messages: [toWire(posted, user.id), toWire(aiMessage, user.id)],
      });
    }
  });
}
