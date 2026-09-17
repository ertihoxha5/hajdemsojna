import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import {
  AIError,
  creativityToTemperature,
  type AIProvider,
  type ObjectOptions,
} from "./types";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Groq adapter.
 *
 * Groq exposes an OpenAI-compatible surface, so it reuses the OpenAI SDK with a
 * different base URL. It speaks Chat Completions rather than the Responses API,
 * and its structured-output support varies by model — so JSON mode plus Zod
 * validation is used instead of a provider-side schema. The caller sees the
 * same AIProvider contract as every other provider.
 */
export function groqProvider(apiKey: string, model?: string): AIProvider {
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  const chosen = model || GROQ_DEFAULT_MODEL;

  return {
    key: "groq",
    model: chosen,

    async generateText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const completion = await client.chat.completions.create({
          model: chosen,
          max_tokens: maxTokens,
          temperature: creativityToTemperature(creativity),
          messages: [{ role: "system", content: system }, ...messages],
        });
        return (completion.choices[0]?.message?.content ?? "").trim();
      } catch (error) {
        throw translate(error);
      }
    },

    async *streamText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const stream = await client.chat.completions.create({
          model: chosen,
          max_tokens: maxTokens,
          temperature: creativityToTemperature(creativity),
          messages: [{ role: "system", content: system }, ...messages],
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      } catch (error) {
        throw translate(error);
      }
    },

    async generateObject<T>({ system, prompt, schema, maxTokens = 4096 }: ObjectOptions<T>) {
      try {
        // JSON mode guarantees parseable output; the exact shape is enforced
        // by Zod below, exactly as it is for every other provider.
        const completion = await client.chat.completions.create({
          model: chosen,
          max_tokens: maxTokens,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${system}\n\nPërgjigju VETËM me një objekt JSON të vlefshëm që përputhet me skemën e kërkuar. Pa tekst shtesë dhe pa blloqe kodi.`,
            },
            { role: "user", content: `${prompt}\n\nSkema JSON:\n${describe(schema)}` },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? "";

        let json: unknown;
        try {
          json = JSON.parse(stripFences(raw));
        } catch {
          throw new AIError("bad_output", "Groq nuk ktheu JSON të vlefshëm");
        }

        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new AIError("bad_output", z.prettifyError(parsed.error));
        }
        return parsed.data;
      } catch (error) {
        throw translate(error);
      }
    },
  };
}

/** A compact JSON-Schema rendering so the model knows the exact shape. */
function describe(schema: z.ZodType): string {
  try {
    return JSON.stringify(z.toJSONSchema(schema, { io: "output" }));
  } catch {
    return "(shiko përshkrimin më lart)";
  }
}

function stripFences(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function translate(error: unknown): AIError {
  if (error instanceof AIError) return error;

  const message = error instanceof Error ? error.message : String(error);
  console.error("[ai:groq]", message);

  if (error instanceof OpenAI.AuthenticationError) {
    return new AIError("invalid_key", message);
  }
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AIError("invalid_key", message);
    }
    if (/insufficient_quota|billing|credit/i.test(message)) {
      return new AIError("no_credit", message);
    }
    if (error.status === 429) {
      return new AIError("rate_limited", message);
    }
    if (error.status === 404 && /model/i.test(message)) {
      return new AIError(
        "unavailable",
        `Modeli "${message}" nuk ekziston te Groq. Ndrysho modelin te Cilësimet → AI.`
      );
    }
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AIError("unavailable", message);
  }
  return new AIError("unavailable", message);
}
