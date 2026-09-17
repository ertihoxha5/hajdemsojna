import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isOnline, requireMembership, touchPresence, toWire } from "@/server/groups";
import { ERRORS, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 1500;
const MAX_LIFETIME_MS = 5 * 60 * 1000;

/**
 * Live group feed over Server-Sent Events.
 *
 * The connection stays open and pushes new messages and presence changes as
 * they appear, so members see each other's messages without polling from the
 * browser. SSE rather than WebSockets because it needs no custom server and
 * survives the serverless model; the client reconnects automatically when the
 * connection is recycled.
 */
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

  const { id } = await params;
  try {
    await requireMembership(id, user.id);
  } catch {
    return jsonError(ERRORS.forbidden, 403, "forbidden");
  }

  const userId = user.id;
  const url = new URL(request.url);
  let cursor = new Date(url.searchParams.get("after") ?? Date.now());

  const encoder = new TextEncoder();
  const startedAt = Date.now();

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

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", close);
      send("ready", { at: cursor.toISOString() });

      const timer = setInterval(async () => {
        if (closed) return;

        try {
          // Being connected is the heartbeat that keeps this member "online".
          await touchPresence(id, userId);

          const fresh = await db.groupMessage.findMany({
            where: { groupId: id, createdAt: { gt: cursor } },
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          if (fresh.length) {
            cursor = fresh[fresh.length - 1].createdAt;
            send("messages", { messages: fresh.map((m) => toWire(m, userId)) });
          }

          const members = await db.studyGroupMember.findMany({
            where: { groupId: id },
            include: { user: { include: { profile: true } } },
          });

          send("presence", {
            members: members.map((m) => ({
              id: m.userId === userId ? "me" : m.userId,
              name: m.userId === userId ? "Ti" : m.user.name,
              initials: `${m.user.name[0] ?? "?"}${m.user.surname[0] ?? ""}`.toUpperCase(),
              tone: m.user.profile?.avatarTone ?? 0,
              role: m.role,
              state: isOnline(m.lastSeen) ? m.state : "offline",
            })),
          });

          // Recycle long-lived connections; the browser reconnects on its own.
          if (Date.now() - startedAt > MAX_LIFETIME_MS) {
            send("bye", { at: cursor.toISOString() });
            close();
          }
        } catch (error) {
          console.error("[groups/stream]", error);
          close();
        }
      }, TICK_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
