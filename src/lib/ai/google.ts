import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import {
  AIError,
  creativityToTemperature,
  type AIProvider,
  type ChatMessage,
  type ObjectOptions,
} from "./types";

export const GOOGLE_DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Gemini adapter.
 *
 * Gemini's native response schema is a subset of JSON Schema with its own
 * types, so rather than translate Zod into it this asks for JSON output and
 * validates with the same Zod schema the other providers use — one source of
 * truth for the shape, and the caller can't tell the difference.
 */
export function googleProvider(apiKey: string, model?: string): AIProvider {
  const genAI = new GoogleGenerativeAI(apiKey);
  const chosen = model || GOOGLE_DEFAULT_MODEL;

  return {
    key: "google",
    model: chosen,

    async generateText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const client = genAI.getGenerativeModel({
          model: chosen,
          systemInstruction: system,
          generationConfig: {
            temperature: creativityToTemperature(creativity),
            maxOutputTokens: maxTokens,
          },
        });
        const { history, latest } = splitHistory(messages);
        const chat = client.startChat({ history });
        const result = await chat.sendMessage(latest);
        return result.response.text().trim();
      } catch (error) {
        throw translate(error);
      }
    },

    async *streamText({ system, messages, maxTokens = 2048, creativity }) {
      try {
        const client = genAI.getGenerativeModel({
          model: chosen,
          systemInstruction: system,
          generationConfig: {
            temperature: creativityToTemperature(creativity),
            maxOutputTokens: maxTokens,
          },
        });
        const { history, latest } = splitHistory(messages);
        const chat = client.startChat({ history });
        const result = await chat.sendMessageStream(latest);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      } catch (error) {
        throw translate(error);
      }
    },

    async generateObject<T>({ system, prompt, schema, maxTokens = 4096 }: ObjectOptions<T>) {
      try {
        const client = genAI.getGenerativeModel({
          model: chosen,
          systemInstruction: `${system}\n\nPërgjigju VETËM me JSON të vlefshëm, pa tekst shtesë dhe pa blloqe kodi.`,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        });

        const result = await client.generateContent(prompt);
        const raw = result.response.text();

        let json: unknown;
        try {
          json = JSON.parse(stripFences(raw));
        } catch {
          throw new AIError("bad_output", "Gemini nuk ktheu JSON të vlefshëm");
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

function splitHistory(messages: ChatMessage[]) {
  const latest = messages[messages.length - 1]?.content ?? "";
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));
  // Gemini rejects a history that opens with a model turn.
  while (history.length && history[0].role === "model") history.shift();
  return { history, latest };
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
  console.error("[ai:google]", message);

  if (/billing|insufficient|credit/i.test(message)) {
    return new AIError("no_credit", message);
  }
  if (/api key|permission|unauthenticated|401|403/i.test(message)) {
    return new AIError("invalid_key", message);
  }
  if (/quota|rate|429|resource_exhausted/i.test(message)) {
    return new AIError("rate_limited", message);
  }
  return new AIError("unavailable", message);
}
