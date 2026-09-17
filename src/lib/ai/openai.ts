import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AIError,
  creativityToTemperature,
  type AIProvider,
  type ObjectOptions,
} from "./types";

export const OPENAI_DEFAULT_MODEL = "gpt-4.1";

/** OpenAI adapter, using the Responses API. */
export function openaiProvider(apiKey: string, model?: string): AIProvider {
  const client = new OpenAI({ apiKey });
  const chosen = model || OPENAI_DEFAULT_MODEL;

  return {
    key: "openai",
    model: chosen,

    async generateText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const response = await client.responses.create({
          model: chosen,
          instructions: system,
          input: messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: maxTokens,
          temperature: creativityToTemperature(creativity),
        });
        return (response.output_text ?? "").trim();
      } catch (error) {
        throw translate(error);
      }
    },

    async *streamText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const stream = await client.responses.create({
          model: chosen,
          instructions: system,
          input: messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: maxTokens,
          temperature: creativityToTemperature(creativity),
          stream: true,
        });

        for await (const event of stream) {
          if (event.type === "response.output_text.delta") yield event.delta;
        }
      } catch (error) {
        throw translate(error);
      }
    },

    async generateObject<T>({ system, prompt, schema, name, maxTokens = 4096 }: ObjectOptions<T>) {
      try {
        const response = await client.responses.parse({
          model: chosen,
          instructions: system,
          input: [{ role: "user", content: prompt }],
          max_output_tokens: maxTokens,
          text: { format: zodTextFormat(schema, name) },
        });

        const parsed = response.output_parsed;
        if (parsed == null) throw new AIError("bad_output");
        return parsed as T;
      } catch (error) {
        throw translate(error);
      }
    },
  };
}

function translate(error: unknown): AIError {
  if (error instanceof AIError) return error;

  console.error("[ai:openai]", error instanceof Error ? error.message : error);

  if (error instanceof OpenAI.AuthenticationError) {
    return new AIError("invalid_key", error.message);
  }
  if (error instanceof OpenAI.APIError && /insufficient_quota|billing/i.test(String(error.message))) {
    return new AIError("no_credit", error.message);
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new AIError("rate_limited", error.message);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AIError("unavailable", error.message);
  }
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AIError("invalid_key", error.message);
    }
    return new AIError("unavailable", error.message);
  }
  return new AIError("unavailable", error instanceof Error ? error.message : String(error));
}
