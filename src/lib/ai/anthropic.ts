import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AIError,
  type AIProvider,
  type GenerateOptions,
  type ObjectOptions,
} from "./types";

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5";

/**
 * Claude adapter.
 *
 * Note that the current Claude models reject sampling parameters, so
 * "creativity" is expressed through the prompt and the effort level rather
 * than a temperature — see resolveEffort below.
 */
export function anthropicProvider(apiKey: string, model?: string): AIProvider {
  const client = new Anthropic({ apiKey });
  const chosen = model || ANTHROPIC_DEFAULT_MODEL;

  return {
    key: "anthropic",
    model: chosen,

    async generateText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const stream = client.messages.stream({
          model: chosen,
          max_tokens: maxTokens,
          output_config: { effort: resolveEffort(creativity) },
          system,
          messages,
        });
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") throw new AIError("refused");
        return textOf(message.content);
      } catch (error) {
        throw translate(error);
      }
    },

    async *streamText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const stream = client.messages.stream({
          model: chosen,
          max_tokens: maxTokens,
          output_config: { effort: resolveEffort(creativity) },
          system,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield event.delta.text;
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") throw new AIError("refused");
      } catch (error) {
        throw translate(error);
      }
    },

    async generateObject<T>({ system, prompt, schema, maxTokens = 4096 }: ObjectOptions<T>) {
      try {
        const message = await client.messages.parse({
          model: chosen,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
          output_config: { format: zodOutputFormat(schema) },
        });

        if (message.stop_reason === "refusal") throw new AIError("refused");

        const parsed = message.parsed_output;
        if (parsed == null) throw new AIError("bad_output");
        return parsed as T;
      } catch (error) {
        throw translate(error);
      }
    },
  };
}

/**
 * Anthropic reports an exhausted balance as a 400 invalid_request_error, not a
 * 402, so it needs matching on the message to avoid looking like a generic
 * outage to the student.
 */
function isBillingError(error: { message?: unknown }): boolean {
  return /credit balance|billing|quota/i.test(String(error.message));
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Deeper reasoning for the tasks where being right matters most. */
function resolveEffort(creativity?: GenerateOptions["creativity"]) {
  if (creativity === "low") return "low" as const;
  if (creativity === "creative") return "high" as const;
  return "medium" as const;
}

function translate(error: unknown): AIError {
  if (error instanceof AIError) return error;

  // The provider's own words, kept server-side so failures are diagnosable.
  console.error("[ai:anthropic]", error instanceof Error ? error.message : error);

  if (error instanceof Anthropic.APIError && isBillingError(error)) {
    return new AIError("no_credit", String(error.message));
  }

  if (error instanceof Anthropic.AuthenticationError) {
    return new AIError("invalid_key", String(error.message));
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIError("rate_limited", String(error.message));
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AIError("unavailable", String(error.message));
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AIError("invalid_key", String(error.message));
    }
    return new AIError("unavailable", String(error.message));
  }
  return new AIError("unavailable", error instanceof Error ? error.message : String(error));
}
