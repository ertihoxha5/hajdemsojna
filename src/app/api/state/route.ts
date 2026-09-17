import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { loadAppState } from "@/server/state";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The signed-in student's full state. Scoped to them by loadAppState. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const today = await getToday();
    const state = await loadAppState(user.id, today);
    return NextResponse.json({ state, today });
  });
}
