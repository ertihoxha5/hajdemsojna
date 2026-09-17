import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { applyAction } from "@/server/mutations";
import { isServerAction, type Action } from "@/lib/store-actions";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { isoDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Applies one client action to the database.
 *
 * The action arrives from the browser, so it is treated as untrusted: the user
 * comes from the session cookie (never the body), and every write inside
 * applyAction filters by that id.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    let body: { action?: Action; today?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError(ERRORS.invalid, 400, "invalid_json");
    }

    const action = body.action;
    if (!action || typeof action.type !== "string") {
      return jsonError(ERRORS.invalid, 400, "invalid_action");
    }
    if (!isServerAction(action)) {
      // Local-only actions are a no-op rather than an error, so a client that
      // posts one by mistake doesn't surface a failure to the student.
      return NextResponse.json({ ok: true, applied: false });
    }

    const today = isoDate.safeParse(body.today).success
      ? (body.today as string)
      : await getToday();

    await applyAction(user.id, action, today);
    return NextResponse.json({ ok: true, applied: true });
  });
}
