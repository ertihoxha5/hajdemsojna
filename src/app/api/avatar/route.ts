import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { avatarInput } from "@/lib/spaces/validation";
import { avatarFromSeed, parseAvatar, serialiseAvatar } from "@/lib/avatar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The character, stored once on the profile.
 *
 * A student who has not built one yet gets a stable avatar derived from their
 * id, so the map is never full of identical figures while people decide.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const profile = await db.userProfile.findUnique({
      where: { userId: user.id },
      select: { avatar: true },
    });

    return NextResponse.json({
      ok: true,
      avatar: profile?.avatar
        ? parseAvatar(profile.avatar)
        : avatarFromSeed(user.id),
      chosen: Boolean(profile?.avatar),
    });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = avatarInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    // parseAvatar wraps every index into range, so a value the builder does
    // not know about still resolves to something drawable.
    const avatar = parseAvatar(JSON.stringify(parsed.data));

    await db.userProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, avatar: serialiseAvatar(avatar) },
      update: { avatar: serialiseAvatar(avatar) },
    });

    return NextResponse.json({ ok: true, avatar });
  });
}
