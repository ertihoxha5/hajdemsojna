"use client";

import { useCallback, useRef, useState } from "react";
import type { QuizQuestion } from "@/lib/types";

/**
 * One-shot AI helpers for the places that need an answer rather than a
 * conversation — a subject's AI tab, focus mode, material actions.
 *
 * Everything here hits a real endpoint. There is no local fallback: if the
 * model is unreachable the caller gets an error to show, not invented text.
 */

const NETWORK_ERROR = "Lidhja dështoi. Kontrollo internetin dhe provo përsëri.";

export function useAIAsk() {
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const ask = useCallback(async (message: string) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;

    setBusy(true);
    setError(null);
    setAnswer("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? NETWORK_ERROR);
        setAnswer(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          const event = lines.find((l) => l.startsWith("event: "))?.slice(7).trim();
          const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
          if (!event || !data) continue;

          try {
            const payload = JSON.parse(data) as { text?: string; message?: string };
            if (event === "delta" && payload.text) {
              full += payload.text;
              setAnswer(full);
            } else if (event === "error") {
              setError(payload.message ?? NETWORK_ERROR);
              setAnswer(null);
            }
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(NETWORK_ERROR);
        setAnswer(null);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setAnswer(null);
    setError(null);
    setBusy(false);
  }, []);

  return { ask, answer, error, busy, reset };
}

export function useAIQuiz() {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(
    async (input: { subjectId: string; count?: number; materialId?: string; topicIds?: string[] }) => {
      setBusy(true);
      setError(null);
      setQuestions(null);

      try {
        const res = await fetch("/api/ai/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error ?? NETWORK_ERROR);
          return null;
        }
        setQuestions(data.questions as QuizQuestion[]);
        return data.questions as QuizQuestion[];
      } catch {
        setError(NETWORK_ERROR);
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  /**
   * Stores a finished quiz.
   *
   * The server recomputes the score from the answers, so this is a record of
   * what happened rather than a claim about how well it went. Failing to save
   * must never destroy the result the student is looking at, so a failure here
   * is reported and otherwise ignored.
   */
  const saveAttempt = useCallback(
    async (input: {
      subjectId?: string | null;
      materialId?: string | null;
      seconds?: number;
      chosen: number[];
      questions: QuizQuestion[];
    }) => {
      try {
        const res = await fetch("/api/quiz/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId: input.subjectId ?? null,
            materialId: input.materialId ?? null,
            source: input.materialId ? "material" : "ai",
            seconds: input.seconds ?? 0,
            answers: input.questions.map((q, i) => ({
              question: q.q,
              options: q.options,
              correctIndex: q.answer,
              chosenIndex: input.chosen[i] ?? -1,
              explanation: q.hint,
              topicName: "",
            })),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? NETWORK_ERROR);
          return null;
        }
        return data as { id: string; correct: number; total: number };
      } catch {
        setError(NETWORK_ERROR);
        return null;
      }
    },
    []
  );

  return { generate, saveAttempt, questions, error, busy };
}

export function useMaterialAI() {
  const [result, setResult] = useState<{ action: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (materialId: string, action: string, label: string) => {
    setBusy(label);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? NETWORK_ERROR);
        return;
      }
      setResult({ action: label, text: data.text as string });
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }, []);

  return { run, result, error, busy };
}
