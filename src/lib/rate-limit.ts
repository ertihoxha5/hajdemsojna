import "server-only";

/**
 * Per-user rate limiting for the routes that cost money.
 *
 * A signed-in student calling /api/ai/* in a loop spends the server's API
 * budget, so every AI route passes through here first. The window is a fixed
 * bucket per user per action: cheap to check, and the reset time is something
 * we can actually tell the student in Albanian.
 *
 * State is in-process, which is the honest trade-off for a single Node server
 * — it is exactly as durable as the SSE connections in src/app/api/groups.
 * Running more than one instance means moving `buckets` to Redis or to a table;
 * nothing outside this file changes when that happens.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Sweep expired buckets so a long-lived process does not grow without bound. */
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface Limit {
  /** Calls allowed inside the window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * The limits are per action, because they do not cost the same. A tutor reply
 * is one streamed call; a study plan reasons over the whole semester.
 */
export const LIMITS = {
  chat: { max: 30, windowSeconds: 300 },
  quiz: { max: 12, windowSeconds: 300 },
  material: { max: 12, windowSeconds: 300 },
  plan: { max: 6, windowSeconds: 600 },
  reschedule: { max: 10, windowSeconds: 600 },
  groupMessage: { max: 20, windowSeconds: 300 },
  keyTest: { max: 6, windowSeconds: 300 },
  /**
   * Unauthenticated and keyed by email address, so it is deliberately the
   * tightest limit here: it caps both reset-link spam to a real inbox and
   * attempts to mine the form for which addresses have accounts.
   */
  passwordReset: { max: 5, windowSeconds: 900 },
  /** Invite codes are six characters, so joining has to be hard to enumerate. */
  spaceJoin: { max: 12, windowSeconds: 300 },
  /** Chat is cheap, but a loop still floods everyone else's screen. */
  roomMessage: { max: 60, windowSeconds: 60 },
  /** A room-wide AI call costs the same as any other model call. */
  roomAI: { max: 12, windowSeconds: 300 },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

export interface RateResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Counts one call against the user's bucket.
 *
 * A rejected call is not counted, so a student hammering the button cannot
 * push their own reset time further away.
 */
export function rateLimit(userId: string, action: LimitName): RateResult {
  const { max, windowSeconds } = LIMITS[action];
  const now = Date.now();
  sweep(now);

  const key = `${action}:${userId}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: max - 1, retryAfter: 0 };
  }

  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count >= max) {
    return { ok: false, remaining: 0, retryAfter };
  }

  existing.count += 1;
  return { ok: true, remaining: max - existing.count, retryAfter };
}

/** Albanian, and specific about when they can try again. */
export function rateLimitMessage(retryAfter: number): string {
  if (retryAfter <= 60) {
    return `Ke bërë shumë kërkesa te AI. Provo përsëri pas ${retryAfter} sekondash.`;
  }
  const minutes = Math.ceil(retryAfter / 60);
  return `Ke bërë shumë kërkesa te AI. Provo përsëri pas ${minutes} minutash.`;
}

/** Test seam — resets all buckets. */
export function __resetRateLimits() {
  buckets.clear();
  lastSweep = Date.now();
}
