/**
 * Presence, and what counts as studying.
 *
 * Every signal here comes from something the browser genuinely knows: whether
 * the tab is visible, when the person last pressed a key or moved, and whether
 * the connection is open. Nothing looks at a camera, a microphone level, or a
 * face. A study app that watches you through the webcam to check you are
 * concentrating is a surveillance product, and this is not one.
 *
 * The consequence of being away is that credited focus time stops
 * accumulating. It is never deducted, and it never stops the group's clock —
 * one person stepping out must not cost everyone else their round.
 */

export type Activity = "active" | "idle" | "away" | "disconnected";

/** Tab hidden or no input for this long, and the student is idle. */
export const IDLE_AFTER_SECONDS = 120;
/** Idle this long without answering the check-in, and they are away. */
export const AWAY_AFTER_SECONDS = 420;
/** No heartbeat at all for this long, and the connection is treated as gone. */
export const DISCONNECTED_AFTER_SECONDS = 45;

export interface PresenceSignals {
  /** Epoch ms of the last real interaction: keypress, pointer, or movement. */
  lastActiveAt: number;
  /** Epoch ms of the last heartbeat from the open connection. */
  lastSeenAt: number;
  /** document.visibilityState === "visible". */
  visible: boolean;
  /** The connection is currently open. */
  connected: boolean;
}

/**
 * Resolves the four signals into one status.
 *
 * Order matters: a dropped connection outranks everything, because a student
 * whose laptop slept is not "idle at their desk", and saying so would be a
 * small lie the rest of the room can see.
 */
export function resolveActivity(
  signals: PresenceSignals,
  now: number
): Activity {
  const sinceSeen = (now - signals.lastSeenAt) / 1000;
  if (!signals.connected || sinceSeen > DISCONNECTED_AFTER_SECONDS) {
    return "disconnected";
  }

  const sinceActive = (now - signals.lastActiveAt) / 1000;

  if (sinceActive > AWAY_AFTER_SECONDS) return "away";

  // A hidden tab is idle immediately: the student is demonstrably looking at
  // something else. It still takes the full timeout to become "away".
  if (!signals.visible || sinceActive > IDLE_AFTER_SECONDS) return "idle";

  return "active";
}

/** Whether this status earns credited focus time. */
export function countsAsPresent(activity: Activity): boolean {
  return activity === "active" || activity === "idle";
}

/** Whether the supervisor should ask "are you still studying?". */
export function shouldCheckIn(activity: Activity): boolean {
  return activity === "idle";
}

export const ACTIVITY_LABEL: Record<Activity, string> = {
  active: "Duke mësuar",
  idle: "Larg për pak",
  away: "Away",
  disconnected: "Jo në linjë",
};

/**
 * A shape as well as a colour for each state.
 *
 * Colour alone would leave a colour-blind student unable to tell an active
 * member from an away one, so every status also carries a distinct glyph and
 * its own label.
 */
export const ACTIVITY_BADGE: Record<
  Activity,
  { glyph: string; tone: "ok" | "warn" | "bad" | "muted" }
> = {
  active: { glyph: "●", tone: "ok" },
  idle: { glyph: "◐", tone: "warn" },
  away: { glyph: "○", tone: "muted" },
  disconnected: { glyph: "×", tone: "bad" },
};

/* ============================================================
   Focus points
   ============================================================ */

/**
 * Points exist to make consistency visible, not to rank students against each
 * other. Nothing here subtracts: being away stops the earning, which is
 * consequence enough, and punishing someone for a bad afternoon is how a
 * study tool starts being avoided.
 */
export const POINTS = {
  perFocusRound: 50,
  goalCompleted: 25,
  quizAnswered: 10,
  /** Awarded once, for being present at the end of a whole session. */
  sessionCompleted: 40,
} as const;

/** Points for a round, scaled by how much of it the student was present for. */
export function roundPoints(presentSeconds: number, roundSeconds: number): number {
  if (roundSeconds <= 0) return 0;
  const share = Math.min(1, Math.max(0, presentSeconds / roundSeconds));
  // Below a third present, the round did not really happen for them.
  if (share < 0.34) return 0;
  return Math.round(POINTS.perFocusRound * share);
}

/**
 * The room's collective focus, 0..100.
 *
 * Derived only from who is connected and active — never from anything
 * observed about a person. A room with nobody in it is 0 rather than NaN.
 */
export function groupFocus(activities: Activity[]): number {
  if (!activities.length) return 0;
  const present = activities.filter(countsAsPresent).length;
  const fullyActive = activities.filter((a) => a === "active").length;
  // Being present counts for something; being active counts for more.
  const score = (present * 0.4 + fullyActive * 0.6) / activities.length;
  return Math.round(score * 100);
}
