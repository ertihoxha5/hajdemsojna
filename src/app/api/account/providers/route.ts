import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { OAuthError, googleConfigured } from "@/lib/oauth/google";
import { linkedProviders, unlinkProvider } from "@/server/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** What is linked, and whether a password remains as a way in. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const row = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    return NextResponse.json({
      ok: true,
      providers: await linkedProviders(user.id),
      hasPassword: Boolean(row.passwordHash),
      googleAvailable: googleConfigured(),
    });
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const provider = new URL(request.url).searchParams.get("provider");
    if (!provider) return jsonError(ERRORS.invalid, 400, "invalid_input");

    try {
      await unlinkProvider(user.id, provider);
    } catch (error) {
      if (error instanceof OAuthError) {
        return jsonError(error.message, 409, error.code);
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  });
}
