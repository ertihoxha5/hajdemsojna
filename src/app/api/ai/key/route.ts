import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canStoreSecrets, seal } from "@/lib/crypto";
import { aiKeyInput } from "@/lib/validation";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stores a user's own provider key, encrypted with AES-256-GCM.
 *
 * The plaintext is sealed immediately and never written to a log or returned.
 * If the server has no encryption key configured, the request is refused
 * rather than silently storing the secret in the clear.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    if (!canStoreSecrets()) {
      return jsonError(
        "Ruajtja e çelësave nuk është e aktivizuar në këtë server (APP_ENCRYPTION_KEY mungon).",
        503,
        "encryption_unavailable"
      );
    }

    const parsed = aiKeyInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? ERRORS.invalid,
        400,
        "invalid_input"
      );
    }

    const { provider, apiKey } = parsed.data;
    const sealed = seal(apiKey);

    await db.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aiProvider: provider,
        aiKeyCipher: sealed.cipher,
        aiKeyIv: sealed.iv,
        aiKeyTag: sealed.tag,
        aiKeyLast4: apiKey.slice(-4),
        aiKeySetAt: new Date(),
      },
      update: {
        aiProvider: provider,
        aiKeyCipher: sealed.cipher,
        aiKeyIv: sealed.iv,
        aiKeyTag: sealed.tag,
        aiKeyLast4: apiKey.slice(-4),
        aiKeySetAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, keyLast4: apiKey.slice(-4) });
  });
}

export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    await db.userSettings.updateMany({
      where: { userId: user.id },
      data: {
        aiKeyCipher: null,
        aiKeyIv: null,
        aiKeyTag: null,
        aiKeyLast4: null,
        aiKeySetAt: null,
      },
    });
    return NextResponse.json({ ok: true });
  });
}
