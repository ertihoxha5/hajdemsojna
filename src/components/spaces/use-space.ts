"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IDLE_AFTER_SECONDS,
  resolveActivity,
  type Activity,
} from "@/lib/spaces/presence";
import type { SessionView } from "@/lib/spaces/session";
import type { MapMember } from "./study-map";
import type { Recap } from "./session-recap";

/** SessionView plus the server timestamp the countdown corrects against. */
export interface SessionSnapshot extends SessionView {
  id: string;
  at: number;
}

/**
 * One room, live.
 *
 * Owns the SSE connection, the presence heartbeat and the optimistic
 * movement, so the page components stay declarative.
 *
 * The heartbeat is the only thing on a timer, and it is a single tiny write
 * every fifteen seconds. Everything the room *shows* arrives by push.
 */

const HEARTBEAT_MS = 15_000;
/** How often to notice that nothing has happened. */
const IDLE_CHECK_MS = 5_000;
/** Backoff cap for reconnects, so a server restart is not a thundering herd. */
const MAX_RETRY_MS = 15_000;

export interface SpaceInfo {
  id: string;
  name: string;
  about: string;
  subjectName: string;
  privacy: string;
  environment: string;
  ambient: string;
  syncAmbient: boolean;
  studyMinutes: number;
  breakMinutes: number;
  roundCount: number;
  maxMembers: number;
  aiSupervisor: boolean;
  rules: string[];
  locked: boolean;
  ownerId: string;
  inviteCode: string | null;
  memberCount: number;
  totalMinutes: number;
}

export interface RoomMessageWire {
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

export type Connection = "connecting" | "open" | "retrying";

export interface Reaction {
  id: number;
  userId: string;
  emoji: string;
}

export function useSpace(spaceId: string) {
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [members, setMembers] = useState<MapMember[]>([]);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [messages, setMessages] = useState<RoomMessageWire[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [meId, setMeId] = useState("");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [idleTooLong, setIdleTooLong] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);

  /**
   * Last real interaction, used to decide active vs idle.
   *
   * Seeded on mount rather than during render: reading the clock while
   * rendering makes the result depend on when React happens to re-render.
   */
  const lastActiveRef = useRef(0);
  const interactedRef = useRef(true);
  const reactionSeq = useRef(0);
  /** Mirrors `session` for the timers, which must not re-subscribe on it. */
  const sessionRef = useRef<SessionSnapshot | null>(null);

  /* ── Real interaction ──────────────────────────────── */

  useEffect(() => {
    const mark = () => {
      lastActiveRef.current = Date.now();
      interactedRef.current = true;
    };

    // Arriving in the room is itself an interaction.
    mark();

    // Only genuine input counts. Nothing here observes a camera or a
    // microphone; "are they concentrating" is not a question this app asks.
    const events: (keyof WindowEventMap)[] = [
      "keydown",
      "pointerdown",
      "pointermove",
      "wheel",
    ];
    for (const e of events) window.addEventListener(e, mark, { passive: true });

    const onVisibility = () => {
      if (document.visibilityState === "visible") mark();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const currentActivity = useCallback((): Activity => {
    return resolveActivity(
      {
        lastActiveAt: lastActiveRef.current,
        lastSeenAt: Date.now(),
        visible:
          typeof document === "undefined" ||
          document.visibilityState === "visible",
        connected: true,
      },
      Date.now()
    );
  }, []);

  /* ── First load ────────────────────────────────────── */

  /**
   * Fetches the room without touching React state.
   *
   * Keeping the fetch and the applying apart is what lets the mount effect
   * have no setState in its body at all — the state lands in a callback,
   * which is the shape effects are actually meant to have. It also makes the
   * result cancellable, so a slow response for a room the student has
   * already left cannot overwrite the one they are now in.
   */
  const fetchRoom = useCallback(async (): Promise<
    | { ok: true; space: SpaceInfo; members: MapMember[]; session: SessionSnapshot | null; messages: RoomMessageWire[] }
    | { ok: false; error: string }
  > => {
    try {
      const [roomRes, msgRes] = await Promise.all([
        fetch(`/api/spaces/${spaceId}`),
        fetch(`/api/spaces/${spaceId}/messages`),
      ]);

      const room = await roomRes.json().catch(() => ({}));
      if (!roomRes.ok) {
        return { ok: false, error: room.error ?? "Nuk u hap dot hapësira." };
      }

      const msg = msgRes.ok ? await msgRes.json().catch(() => ({})) : {};

      return {
        ok: true,
        space: room.space,
        members: room.members,
        session: room.session,
        messages: msg.messages ?? [],
      };
    } catch {
      return { ok: false, error: "Lidhja dështoi. Kontrollo internetin." };
    }
  }, [spaceId]);

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchRoom>>) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSpace(result.space);
      setMembers(result.members);
      setSession(result.session);
      setMessages(result.messages);
    },
    []
  );

  /** Re-reads the room. Called from handlers, never from an effect body. */
  const reload = useCallback(async () => {
    apply(await fetchRoom());
  }, [apply, fetchRoom]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    void fetchRoom().then((result) => {
      if (!cancelled) apply(result);
    });

    return () => {
      cancelled = true;
    };
  }, [apply, fetchRoom]);

  /* ── The live feed ─────────────────────────────────── */

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`/api/spaces/${spaceId}/stream`);

      source.addEventListener("open", () => {
        attempt = 0;
        setConnection("open");
      });

      source.addEventListener("hello", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setMeId(data.userId);
        setMembers(data.members);
        setSession(data.session);
        setConnection("open");
      });

      source.addEventListener("presence", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setMembers(data.members);
      });

      source.addEventListener("move", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setMembers((current) =>
          current.map((m) =>
            m.userId === data.userId
              ? { ...m, x: data.x, y: data.y, seatId: data.seatId }
              : m
          )
        );
      });

      source.addEventListener("session", (e) => {
        const payload = JSON.parse((e as MessageEvent).data).session;
        // The finishing event carries the recap instead of a clock.
        if (payload?.recap) {
          setRecap(payload.recap);
          return;
        }
        setSession(payload);
      });

      source.addEventListener("space", (e) => {
        setSpace(JSON.parse((e as MessageEvent).data).space);
      });

      source.addEventListener("message", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setMessages((current) =>
          // The poster already added it optimistically, and the server echoes
          // to everyone including them.
          current.some((m) => m.id === data.message.id)
            ? current
            : [...current, data.message]
        );
      });

      source.addEventListener("reaction", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        const id = ++reactionSeq.current;
        setReactions((r) => [...r, { id, userId: data.userId, emoji: data.emoji }]);
        // Reactions are a wave, not a record: they fade rather than pile up.
        setTimeout(
          () => setReactions((r) => r.filter((x) => x.id !== id)),
          2600
        );
      });

      source.addEventListener("bye", () => {
        source?.close();
        setConnection("retrying");
        retry = setTimeout(connect, 400);
      });

      source.addEventListener("error", () => {
        source?.close();
        if (cancelled) return;
        setConnection("retrying");
        attempt += 1;
        const wait = Math.min(MAX_RETRY_MS, 600 * 2 ** Math.min(attempt, 5));
        retry = setTimeout(connect, wait);
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [spaceId]);

  /* ── Heartbeat ─────────────────────────────────────── */

  useEffect(() => {
    const beat = async () => {
      const interacted = interactedRef.current;
      interactedRef.current = false;

      try {
        await fetch(`/api/spaces/${spaceId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activity: currentActivity(), interacted }),
        });
      } catch {
        // A missed beat is not worth surfacing; the next one covers it.
      }
    };

    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [currentActivity, spaceId]);

  /* ── Actions ───────────────────────────────────────── */

  const move = useCallback(
    async (x: number, y: number, seatId: string | null) => {
      // Optimistic: the avatar steps now, the server hears about it after.
      setMembers((current) =>
        current.map((m) => (m.userId === meId ? { ...m, x, y, seatId } : m))
      );
      lastActiveRef.current = Date.now();
      interactedRef.current = true;

      try {
        const res = await fetch(`/api/spaces/${spaceId}/presence`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y, seatId }),
        });
        if (!res.ok) {
          // Refused — a taken seat, most likely. Snap back to the truth.
          await reload();
        }
      } catch {
        await reload();
      }
    },
    [meId, reload, spaceId]
  );

  const send = useCallback(
    async (text: string, replyToId: string | null = null) => {
      const res = await fetch(`/api/spaces/${spaceId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, replyToId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error ?? "Mesazhi nuk u dërgua.";
      }
      return null;
    },
    [spaceId]
  );

  const react = useCallback(
    async (emoji: string) => {
      await fetch(`/api/spaces/${spaceId}/messages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      }).catch(() => {});
    },
    [spaceId]
  );

  const command = useCallback(
    async (action: "start" | "pause" | "resume" | "skip" | "end") => {
      const res = await fetch(`/api/spaces/${spaceId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Veprimi dështoi.";

      // Ending or finishing the last round returns the recap.
      if (data.recap) setRecap(data.recap);
      return null;
    },
    [spaceId]
  );

  const setStudyStatus = useCallback(
    async (input: {
      studySubject: string;
      studyTopic: string;
      studyGoal: string;
      goalDone: boolean;
    }) => {
      await fetch(`/api/spaces/${spaceId}/presence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).catch(() => {});
    },
    [spaceId]
  );

  /** Confirms the student is still there, clearing an idle check-in. */
  const confirmPresence = useCallback(() => {
    lastActiveRef.current = Date.now();
    interactedRef.current = true;
  }, []);

  const me = useMemo(
    () => members.find((m) => m.userId === meId) ?? null,
    [meId, members]
  );

  /**
   * Whether the supervisor should ask if they are still studying.
   *
   * This was a useMemo over `session`, which was simply wrong: going idle is
   * the passage of time, not a change to the session, so the value never
   * recomputed and the prompt never appeared. A timer is the only thing that
   * can notice nothing happening.
   */
  useEffect(() => {
    const check = () => {
      const focusing = sessionRef.current?.mode === "focus";
      setIdleTooLong(
        focusing &&
          (Date.now() - lastActiveRef.current) / 1000 > IDLE_AFTER_SECONDS
      );
    };

    const timer = setInterval(check, IDLE_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return {
    space,
    members,
    session,
    messages,
    reactions,
    meId,
    me,
    connection,
    error,
    idleTooLong,
    recap,
    dismissRecap: useCallback(() => setRecap(null), []),
    move,
    send,
    react,
    command,
    setStudyStatus,
    confirmPresence,
    reload,
  };
}
