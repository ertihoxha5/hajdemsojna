import "server-only";
import { db } from "@/lib/db";
import { open } from "@/lib/crypto";
import { anthropicProvider, ANTHROPIC_DEFAULT_MODEL } from "./anthropic";
import { openaiProvider, OPENAI_DEFAULT_MODEL } from "./openai";
import { googleProvider, GOOGLE_DEFAULT_MODEL } from "./google";
import { groqProvider, GROQ_DEFAULT_MODEL } from "./groq";
import { AIError, type AIProvider, type Creativity, type ProviderKey } from "./types";

export * from "./types";
export { ANTHROPIC_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, GOOGLE_DEFAULT_MODEL, GROQ_DEFAULT_MODEL };

const ENV_KEYS: Record<ProviderKey, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
};

export const PROVIDER_LABEL: Record<ProviderKey, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google Gemini",
  groq: "Groq",
};

export const DEFAULT_MODEL: Record<ProviderKey, string> = {
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
  google: GOOGLE_DEFAULT_MODEL,
  groq: GROQ_DEFAULT_MODEL,
};

/** Preference order when nothing is configured explicitly. */
const ORDER: ProviderKey[] = ["anthropic", "openai", "groq", "google"];

function envKey(provider: ProviderKey): string | null {
  const value = process.env[ENV_KEYS[provider]];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Which providers the server itself can serve, with no user key involved. */
export function serverConfiguredProviders(): ProviderKey[] {
  return ORDER.filter((p) => envKey(p) !== null);
}

function build(provider: ProviderKey, apiKey: string, model?: string): AIProvider {
  switch (provider) {
    case "anthropic":
      return anthropicProvider(apiKey, model);
    case "openai":
      return openaiProvider(apiKey, model);
    case "google":
      return googleProvider(apiKey, model);
    case "groq":
      return groqProvider(apiKey, model);
  }
}

export interface ResolvedAI {
  provider: AIProvider;
  creativity: Creativity;
  language: "sq" | "en";
  /** Where the key came from — surfaced in settings, never the key itself. */
  source: "user" | "server";
}

/**
 * Picks the provider for this user.
 *
 * A key the user saved themselves wins; otherwise the server's own key is
 * used. The plaintext key exists only inside this function's call stack — it
 * is never returned to a caller that could serialise it to the browser.
 */
export async function resolveAI(userId: string): Promise<ResolvedAI> {
  const settings = await db.userSettings.findUnique({ where: { userId } });

  const creativity = (settings?.aiCreativity ?? "balanced") as Creativity;
  const language = (settings?.language ?? "sq") as "sq" | "en";
  const preferred = (settings?.aiProvider as ProviderKey | null) ?? null;

  // 1. The user's own encrypted key.
  if (preferred && settings?.aiKeyCipher && settings.aiKeyIv && settings.aiKeyTag) {
    try {
      const apiKey = open({
        cipher: settings.aiKeyCipher,
        iv: settings.aiKeyIv,
        tag: settings.aiKeyTag,
      });
      return {
        provider: build(preferred, apiKey, settings.aiModel ?? undefined),
        creativity,
        language,
        source: "user",
      };
    } catch {
      // A key we can no longer decrypt (rotated APP_ENCRYPTION_KEY) falls
      // through to the server key rather than failing the request outright.
    }
  }

  // 2. The user's chosen provider, served by the platform's key.
  if (preferred) {
    const key = envKey(preferred);
    if (key) {
      return {
        provider: build(preferred, key, settings?.aiModel ?? undefined),
        creativity,
        language,
        source: "server",
      };
    }
  }

  // 3. Whatever the server has configured.
  for (const candidate of ORDER) {
    const key = envKey(candidate);
    if (key) {
      return {
        provider: build(candidate, key, undefined),
        creativity,
        language,
        source: "server",
      };
    }
  }

  throw new AIError("not_configured");
}

/** True when this user could make an AI request right now. */
export async function aiAvailable(userId: string): Promise<boolean> {
  try {
    await resolveAI(userId);
    return true;
  } catch {
    return false;
  }
}
