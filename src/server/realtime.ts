import "server-only";
import { EventEmitter } from "node:events";

/**
 * The room event bus.
 *
 * The previous group feed held an SSE connection open and then queried the
 * database every 1500ms inside it. That is polling with extra steps: it costs
 * a query per member per tick whether or not anything happened, and it still
 * makes a message up to 1.5 seconds late.
 *
 * Here a write publishes, and every open connection for that space is handed
 * the event immediately. Nothing is queried on a timer, and a message posted
 * at 12:00:00.000 reaches the other browsers in the same tick.
 *
 * Scope, stated honestly: this is in-process, exactly like src/lib/rate-limit.ts.
 * One Node instance serves one set of rooms. Running several means giving the
 * bus a shared backend — Redis pub/sub, or Postgres LISTEN/NOTIFY — and
 * nothing outside this file changes, because publish/subscribe is the whole
 * surface.
 */

/** Everything that can happen in a space. */
export type RoomEvent =
  | { type: "message"; message: unknown }
  | { type: "message:update"; message: unknown }
  | { type: "presence"; members: unknown[] }
  | { type: "move"; userId: string; x: number; y: number; seatId: string | null }
  | { type: "session"; session: unknown }
  | { type: "space"; space: unknown }
  | { type: "reaction"; userId: string; emoji: string }
  | { type: "quiz"; quiz: unknown }
  | { type: "quiz:answer"; answered: number; total: number }
  | { type: "ai"; text: string }
  | { type: "signal"; from: string; to: string; payload: unknown };

type Listener = (event: RoomEvent) => void;

/**
 * Node's EventEmitter warns past ten listeners on one channel, which for a
 * study space is a normal room rather than a leak.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

const channel = (spaceId: string) => `space:${spaceId}`;

/** Pushes an event to everyone currently connected to a space. */
export function publish(spaceId: string, event: RoomEvent): void {
  bus.emit(channel(spaceId), event);
}

/**
 * Subscribes to a space. Returns the unsubscribe function, which the SSE route
 * must call when the connection closes — a listener left behind is a real
 * memory leak, because it pins the whole controller.
 */
export function subscribe(spaceId: string, listener: Listener): () => void {
  const name = channel(spaceId);
  bus.on(name, listener);
  return () => {
    bus.off(name, listener);
  };
}

/** How many connections a space currently has. Used by tests and diagnostics. */
export function listenerCount(spaceId: string): number {
  return bus.listenerCount(channel(spaceId));
}

/** Test seam. */
export function __resetBus(): void {
  bus.removeAllListeners();
}
