"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  RECALL_LABELS,
  RECALL_ORDER,
  intervalLabel,
  previewIntervals,
  type Recall,
} from "@/lib/srs";
import { Button, Card, EmptyState, cx } from "@/components/ui";

/**
 * The review screen: one card at a time, answer hidden until asked for.
 *
 * The four buttons show the interval each choice would produce, because a
 * student who can see that "Lehtë" means three weeks is far more likely to
 * grade themselves honestly than one who is guessing what the buttons do.
 *
 * A failed card is pushed back to the end of the queue rather than dropped,
 * so a session genuinely ends when everything has been recalled once.
 */

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

interface Props {
  cards: ReviewCard[];
  today: string;
  onFinished?: () => void;
}

export function ReviewSession({ cards, today, onFinished }: Props) {
  const [queue, setQueue] = useState<ReviewCard[]>(cards);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    setQueue(cards);
    setRevealed(false);
    setDone(0);
    setAgain(0);
  }, [cards]);

  const current = queue[0];

  const previews = useMemo(
    () => (current ? previewIntervals(current, today) : null),
    [current, today]
  );

  const answer = useCallback(
    async (recall: Recall) => {
      if (!current || busy) return;

      setBusy(true);
      setError(null);

      try {
        const res = await fetch("/api/flashcards/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: current.id, recall }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Nuk u ruajt dot. Provo përsëri.");
          return;
        }

        setDone((n) => n + 1);
        setRevealed(false);

        // A forgotten card comes round again before the session ends.
        if (data.lapsed) {
          setAgain((n) => n + 1);
          setQueue(([, ...rest]) => [...rest, { ...current, ...data.card }]);
        } else {
          setQueue(([, ...rest]) => rest);
        }
      } catch {
        setError("Lidhja dështoi. Kontrollo internetin dhe provo përsëri.");
      } finally {
        setBusy(false);
      }
    },
    [busy, current]
  );

  // Space reveals, 1–4 grade. Keyboard is how anyone reviews at any volume.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current || busy) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (!revealed && (event.code === "Space" || event.code === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      if (revealed) {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < RECALL_ORDER.length) {
          event.preventDefault();
          void answer(RECALL_ORDER[index]);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, busy, current, revealed]);

  if (!current) {
    return (
      <EmptyState
        icon={<Check size={22} />}
        title={done ? "Përsëritja mbaroi" : "Asgjë për të përsëritur"}
        body={
          done
            ? `Përsërite ${done} kart${done === 1 ? "ë" : "a"}${
                again ? `, ${again} prej tyre u kthyen për t'u rifreskuar` : ""
              }. Kthehu nesër për raundin tjetër.`
            : "Nuk ke karta të planifikuara për sot. Krijo disa nga një lëndë ose material."
        }
        action={
          done && onFinished ? (
            <Button onClick={onFinished}>
              <RotateCcw size={14} />
              Rifresko
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>
          {queue.length} kart{queue.length === 1 ? "ë" : "a"} të mbetura
        </span>
        <span>
          {done} e përsëritur{again > 0 && ` · ${again} për rifreskim`}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{
            width: `${done + queue.length ? (done / (done + queue.length)) * 100 : 0}%`,
          }}
        />
      </div>

      <Card className="flex min-h-[260px] flex-col justify-center gap-5 px-6 py-8 text-center">
        <p className="text-[19px] font-medium leading-relaxed text-ink">
          {current.front}
        </p>

        {revealed ? (
          <>
            <div className="mx-auto h-px w-16 bg-line" />
            <p className="anim-pop text-[16px] leading-relaxed text-muted">
              {current.back}
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mx-auto mt-2 rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-brand transition-colors hover:border-brand"
          >
            Shfaq përgjigjen
            <span className="ml-2 text-[12px] text-faint">Hapësirë</span>
          </button>
        )}
      </Card>

      {error && (
        <p className="rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
          {error}
        </p>
      )}

      {revealed && previews && (
        <div className="anim-pop grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RECALL_ORDER.map((recall, index) => (
            <button
              key={recall}
              type="button"
              disabled={busy}
              onClick={() => void answer(recall)}
              className={cx(
                "flex flex-col items-center gap-0.5 rounded-[10px] border px-3 py-2.5 transition-colors disabled:opacity-60",
                recall === "nuk-e-dita"
                  ? "border-bad/30 text-bad hover:border-bad hover:bg-bad-soft"
                  : recall === "lehte"
                    ? "border-ok/30 text-ok hover:border-ok hover:bg-ok-soft"
                    : "border-line text-ink hover:border-brand"
              )}
            >
              <span className="text-[13.5px] font-medium">
                {RECALL_LABELS[recall]}
              </span>
              <span className="text-[11.5px] text-faint">
                {intervalLabel(previews[recall])}
              </span>
              <span className="text-[10.5px] text-faint">{index + 1}</span>
            </button>
          ))}
        </div>
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 text-[13px] text-faint">
          <Loader2 size={13} className="animate-spin" />
          Po ruaj…
        </p>
      )}
    </div>
  );
}

/** Small banner used on Sot and on a subject page. */
export function DueCardsCallout({ due }: { due: number }) {
  if (!due) return null;
  return (
    <a
      href="/perserit"
      className="flex items-center gap-3 rounded-[12px] border border-brand/25 bg-brand-soft px-4 py-3 transition-colors hover:border-brand/50"
    >
      <Sparkles size={16} className="shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">
          {due} kart{due === 1 ? "ë" : "a"} për përsëritje
        </p>
        <p className="text-[12.5px] text-muted">
          Pesë minuta tani ia vlejnë më shumë se një orë para provimit.
        </p>
      </div>
    </a>
  );
}
