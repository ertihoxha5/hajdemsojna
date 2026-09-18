import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { streamTutorReply } from "@/lib/ai/tasks";
import { AIError } from "@/lib/ai/types";
import { aiChatInput } from "@/lib/validation";
import { ERRORS, enforceRateLimit, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The tutor conversation, streamed.
 *
 * Tokens are sent as they arrive so the student sees the answer forming. The
 * full reply is persisted once the stream completes, so reloading the page
 * shows the same conversation.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return jsonError(ERRORS.unauthorized, 401, "unauthorized");
  }

  const limited = enforceRateLimit(user.id, "chat");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(ERRORS.invalid, 400, "invalid_json");
  }

  const parsed = aiChatInput.safeParse(body);
  if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

  const { message, conversationId } = parsed.data;
  const today = await getToday();

  // Find or start the conversation, then load recent turns for context.
  let conversation = conversationId
    ? await db.aIConversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      })
    : null;

  if (!conversation) {
    conversation = await db.aIConversation.create({
      data: { userId: user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
  }

  const history = conversation.messages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  await db.aIMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  let stream: AsyncGenerator<string, void, unknown>;
  try {
    stream = await streamTutorReply(user.id, today, history, message);
  } catch (error) {
    if (error instanceof AIError) return jsonError(error.message, error.status, error.code);
    console.error("[ai/chat]", error);
    return jsonError(ERRORS.aiUnavailable, 502, "unavailable");
  }

  const conversationIdOut = conversation.id;
  const encoder = new TextEncoder();
  let full = "";

  const body$ = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );

      send("start", { conversationId: conversationIdOut });

      try {
        for await (const chunk of stream) {
          full += chunk;
          send("delta", { text: chunk });
        }

        await db.aIMessage.create({
          data: { conversationId: conversationIdOut, role: "assistant", content: full },
        });
        await db.aIConversation.update({
          where: { id: conversationIdOut },
          data: { updatedAt: new Date() },
        });

        send("done", { text: full });
      } catch (error) {
        const message =
          error instanceof AIError ? error.message : ERRORS.aiUnavailable;
        if (!(error instanceof AIError)) console.error("[ai/chat stream]", error);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
