import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroySession, requireUser } from "@/lib/session";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Deletes the account and, by cascade, every row that belongs to it. */
export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    await destroySession();
    await db.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  });
}
