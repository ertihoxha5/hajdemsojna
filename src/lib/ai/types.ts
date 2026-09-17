import type { z } from "zod";

export type ProviderKey = "anthropic" | "openai" | "google" | "groq";
export type Creativity = "low" | "balanced" | "creative";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  creativity?: Creativity;
}

export interface ObjectOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Name given to the schema in the provider's structured-output call. */
  name: string;
  maxTokens?: number;
}

/**
 * What every provider must be able to do.
 *
 * Application code depends only on this interface, so swapping Anthropic for
 * OpenAI or Gemini is a settings change rather than a rewrite. Each adapter is
 * responsible for translating its SDK's failures into AIError.
 */
export interface AIProvider {
  readonly key: ProviderKey;
  readonly model: string;

  generateText(options: GenerateOptions): Promise<string>;
  streamText(options: GenerateOptions): AsyncGenerator<string, void, unknown>;
  generateObject<T>(options: ObjectOptions<T>): Promise<T>;
}

export type AIErrorCode =
  | "not_configured"
  | "invalid_key"
  | "no_credit"
  | "rate_limited"
  | "unavailable"
  | "bad_output"
  | "refused";

/** Albanian, user-facing, and safe to show — no provider internals leak out. */
const MESSAGES: Record<AIErrorCode, string> = {
  not_configured:
    "AI nuk është konfiguruar. Shto një çelës API te Cilësimet → AI.",
  invalid_key: "API key nuk është valide.",
  no_credit:
    "Llogaria e AI nuk ka kredi të mjaftueshme. Shto kredi te faqja e faturimit e ofruesit dhe provo përsëri.",
  rate_limited: "Ke arritur limitin e përkohshëm të AI. Provo pas pak.",
  unavailable: "AI Asistenti për momentin nuk është i disponueshëm. Provo përsëri.",
  bad_output: "AI ktheu një përgjigje të pavlefshme. Provo përsëri.",
  refused: "AI nuk mundi ta plotësojë këtë kërkesë.",
};

export class AIError extends Error {
  code: AIErrorCode;
  status: number;

  constructor(code: AIErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "AIError";
    this.code = code;
    this.status =
      code === "not_configured"
        ? 503
        : code === "rate_limited"
          ? 429
          : code === "invalid_key"
            ? 401
            : code === "no_credit"
              ? 402
              : 502;
    // Kept server-side for logs; never serialised to the client.
    if (detail) this.cause = detail;
  }
}

export function creativityToTemperature(c: Creativity = "balanced"): number {
  return c === "low" ? 0.2 : c === "creative" ? 0.9 : 0.6;
}
