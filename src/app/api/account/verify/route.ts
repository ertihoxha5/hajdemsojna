import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, enforceRateLimit, handle, jsonError } from "@/lib/api";
import { requestEmailVerification } from "@/lib/email-verify";
import { mailConfigured, sendMail, verifyEmailMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Whether this student still needs to confirm their address. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const row = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { emailVerified: true },
    });

    return NextResponse.json({
      ok: true,
      verified: Boolean(row.emailVerified),
      email: user.email,
    });
  });
}

/** Sends another confirmation link. */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();

    const limited = enforceRateLimit(user.id, "passwordReset");
    if (limited) return limited;

    const request = await requestEmailVerification(user.email);
    if (!request) {
      // Already confirmed. Not an error worth showing as a failure.
      return NextResponse.json({ ok: true, verified: true });
    }

    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/konfirmo?token=${encodeURIComponent(request.token)}`;

    try {
      await sendMail(verifyEmailMail(user.email, link, user.name));
    } catch (error) {
      console.error("[account/verify]", error);
      return jsonError(ERRORS.server, 502, "mail_failed");
    }

    return NextResponse.json({
      ok: true,
      verified: false,
      logged: !mailConfigured(),
    });
  });
}
