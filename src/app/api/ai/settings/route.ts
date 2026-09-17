import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canStoreSecrets } from "@/lib/crypto";
import { DEFAULT_MODEL, PROVIDER_LABEL, serverConfiguredProviders } from "@/lib/ai";
import { aiSettingsInput } from "@/lib/validation";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns what the settings screen needs. Never returns a key — only whether
 * one is stored and its last four characters.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const settings = await db.userSettings.findUnique({ where: { userId: user.id } });

    return NextResponse.json({
      provider: settings?.aiProvider ?? null,
      model: settings?.aiModel ?? null,
      creativity: settings?.aiCreativity ?? "balanced",
      language: settings?.language ?? "sq",
      hasOwnKey: !!settings?.aiKeyCipher,
      keyLast4: settings?.aiKeyLast4 ?? null,
      keySetAt: settings?.aiKeySetAt ?? null,
      serverProviders: serverConfiguredProviders(),
      canStoreKeys: canStoreSecrets(),
      labels: PROVIDER_LABEL,
      defaultModels: DEFAULT_MODEL,
    });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = aiSettingsInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const { provider, model, creativity, language } = parsed.data;

    await db.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aiProvider: provider ?? null,
        aiModel: model ?? null,
        aiCreativity: creativity ?? "balanced",
        language: language ?? "sq",
      },
      update: {
        ...(provider !== undefined ? { aiProvider: provider } : {}),
        ...(model !== undefined ? { aiModel: model } : {}),
        ...(creativity ? { aiCreativity: creativity } : {}),
        ...(language ? { language } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  });
}
