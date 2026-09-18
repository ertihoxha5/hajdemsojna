import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { handle } from "@/lib/api";
import { buildCalendar } from "@/server/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The timetable as an .ics file.
 *
 * This is a download rather than a subscribable feed on purpose: a feed URL has
 * to carry its own credential, since calendar clients do not send cookies, and
 * a long-lived token in a URL that gets pasted between devices is a worse trade
 * than re-downloading after a schedule change.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();
    const ics = await buildCalendar(user.id, today);

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hajdemsojna.ics"',
        "Cache-Control": "no-store, private",
      },
    });
  });
}
