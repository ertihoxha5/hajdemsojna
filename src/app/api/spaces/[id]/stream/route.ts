import { requireUser } from "@/lib/session";
import { ERRORS, jsonError } from "@/lib/api";
import { subscribe } from "@/server/realtime";
import {
  SpaceError,
  broadcastPresence,
  currentSession,
  listMembers,
  requireMember,
} from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The room's live feed.
 *
 * Genuinely push: this route subscribes to the in-process bus and forwards
 * whatever is published for the space. It runs no timer that touches the
 * database, so an idle room costs nothing and a message posted now arrives
 * now, rather than on the next poll.
 *
 * The only interval here is a comment line every 25 seconds, which exists to
 * stop proxies closing a quiet connection. It queries nothing.
 */

const KEEPALIVE_MS = 25_000;
/** Connections are recycled so a process restart cannot strand a client. */
const MAX_LIFETIME_MS = 30 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return jsonError(ERRORS.unauthorized, 401, "unauthorized");
  }

  const { id: spaceId } = await params;

  try {
    await requireMember(spaceId, user.id);
  } catch (error) {
    if (error instanceof SpaceError) {
      return jsonError(error.message, error.status, error.code);
    }
    throw error;
  }

  const userId = user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Forward every event published for this space.
      const unsubscribe = subscribe(spaceId, (event) => {
        // Signalling is addressed: only the intended peer should receive it.
        if (event.type === "signal" && event.to !== userId) return;
        send(event.type, event);
      });

      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
        }
      }, KEEPALIVE_MS);

      const lifetime = setTimeout(() => {
        send("bye", { reason: "recycle" });
        close();
      }, MAX_LIFETIME_MS);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        clearTimeout(lifetime);
        // Leaving the listener attached would pin this controller forever.
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        // Everyone else should see them drop off.
        void broadcastPresence(spaceId).catch(() => {});
      }

      request.signal.addEventListener("abort", close);

      // The opening frame carries the whole current state, so a client that
      // reconnects is immediately correct rather than waiting for the next
      // thing to happen.
      send("hello", {
        userId,
        members: await listMembers(spaceId, userId),
        session: await currentSession(spaceId),
      });

      // Tell the rest of the room someone arrived.
      await broadcastPresence(spaceId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx buffering the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
