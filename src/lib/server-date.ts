import "server-only";
import { cookies } from "next/headers";
import { iso } from "./date";

export const TZ_COOKIE = "hm_tz";

/**
 * "Today" in the student's own timezone.
 *
 * A scheduling app must agree with the clock on the student's wall, not the
 * server's. A tiny script in the root layout stores the browser's UTC offset
 * in a cookie; this reads it so server-rendered dates match what the client
 * will compute after hydration. Falls back to server local time on the very
 * first request, before the cookie exists.
 */
export async function getToday(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(TZ_COOKIE)?.value;
  const offset = raw ? Number(raw) : NaN;

  if (!Number.isFinite(offset) || Math.abs(offset) > 900) {
    return iso(new Date());
  }

  // getTimezoneOffset() is minutes behind UTC, so subtract to get local time.
  const local = new Date(Date.now() - offset * 60_000);
  const m = `${local.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${local.getUTCDate()}`.padStart(2, "0");
  return `${local.getUTCFullYear()}-${m}-${d}`;
}
