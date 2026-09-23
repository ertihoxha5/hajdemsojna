"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { deckStrength, intervalLabel } from "@/lib/srs";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SectionTitle,
  Segmented,
  Select,
  Stat,
  Textarea,
} from "@/components/ui";
import { ReviewSession, type ReviewCard } from "@/components/app/review-session";

/**
 * Përsëritja — spaced repetition over the student's own cards.
 *
 * The deck is loaded from the server rather than the client store, because
 * scheduling state changes on every answer and is the one thing here that must
 * never be optimistic: a card shown as due when it is not wastes the student's
 * evening.
 */

interface CardWire extends ReviewCard {
  subjectId: string | null;
  due: string;
  source: string;
  suspended: boolean;
  lastReviewed: string | null;
}

interface Summary {
  total: number;
  due: number;
  fresh: number;
  learning: number;
  mature: number;
  reviewedToday: number;
}

export default function ReviewPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<"perserit" | "deku">("perserit");
  const [subjectId, setSubjectId] = useState<string>("");

  const [cards, setCards] = useState<CardWire[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  /** Fetches without touching state, so the effect body stays state-free. */
  const fetchDeck = useCallback(async (): Promise<
    | { ok: true; cards: CardWire[]; summary: Summary | null; today: string }
    | { ok: false; error: string }
  > => {
    try {
      const params = new URLSearchParams();
      if (tab === "perserit") params.set("scope", "due");
      if (subjectId) params.set("subjectId", subjectId);

      const res = await fetch(`/api/flashcards?${params}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { ok: false, error: data.error ?? "Nuk u ngarkuan dot kartat." };
      }

      return {
        ok: true,
        cards: data.cards ?? [],
        summary: data.summary ?? null,
        today: data.today ?? "",
      };
    } catch {
      return {
        ok: false,
        error: "Lidhja dështoi. Kontrollo internetin dhe provo përsëri.",
      };
    }
  }, [subjectId, tab]);

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchDeck>>) => {
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setError(null);
    setCards(result.cards);
    setSummary(result.summary);
    setToday(result.today);
    setLoading(false);
  }, []);

  /** Re-reads the deck. Called from handlers, never from an effect body. */
  const load = useCallback(async () => {
    apply(await fetchDeck());
  }, [apply, fetchDeck]);

  useEffect(() => {
    let cancelled = false;

    void fetchDeck().then((result) => {
      if (!cancelled) apply(result);
    });

    return () => {
      cancelled = true;
    };
  }, [apply, fetchDeck]);

  const remove = async (id: string) => {
    setCards((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/flashcards?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    void load();
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Përsëritja"
        question="Karta që kthehen pikërisht kur je gati t'i harrosh."
        right={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGenerating(true)}>
              <Sparkles size={14} />
              Gjenero me AI
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={14} />
              Kartë e re
            </Button>
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Për sot" value={String(summary.due)} />
          <Stat label="Të reja" value={String(summary.fresh)} />
          <Stat label="Në mësim" value={String(summary.learning)} />
          <Stat label="Të konsoliduara" value={String(summary.mature)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { key: "perserit", label: "Përsërit" },
            { key: "deku", label: "Të gjitha kartat" },
          ]}
        />

        {state.subjects.length > 0 && (
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="h-9 w-auto"
          >
            <option value="">Të gjitha lëndët</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {error && (
        <p className="rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted">
          <Loader2 size={15} className="animate-spin" />
          Po ngarkoj kartat…
        </Card>
      ) : tab === "perserit" ? (
        <ReviewSession
          // A new deck is a fresh run: remount rather than reset piecemeal.
          key={cards.map((c) => c.id).join(",")}
          cards={cards}
          today={today}
          onFinished={load}
        />
      ) : (
        <DeckList cards={cards} subjects={state.subjects} onRemove={remove} />
      )}

      {adding && (
        <NewCardModal
          subjects={state.subjects}
          defaultSubjectId={subjectId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      {generating && (
        <GenerateModal
          subjects={state.subjects}
          materials={state.materials}
          defaultSubjectId={subjectId}
          onClose={() => setGenerating(false)}
          onGenerated={() => {
            setGenerating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Deck
   ============================================================ */

function DeckList({
  cards,
  subjects,
  onRemove,
}: {
  cards: CardWire[];
  subjects: { id: string; name: string }[];
  onRemove: (id: string) => void;
}) {
  if (!cards.length) {
    return (
      <EmptyState
        icon={<Layers size={22} />}
        title="Deku është bosh"
        body="Krijo karta vetë, ose lëri AI-t t'i nxjerrë nga një lëndë apo material."
      />
    );
  }

  const strength = deckStrength(cards);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle sub={`Forca e dekut ${strength}% — sa prej tyre i mban gjatë.`}>
        {cards.length} karta
      </SectionTitle>

      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <Card key={card.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{card.front}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{card.back}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
                <span>
                  {subjects.find((s) => s.id === card.subjectId)?.name ?? "Pa lëndë"}
                </span>
                <span>
                  {card.repetitions === 0
                    ? "E re"
                    : `Kthehet ${intervalLabel(card.intervalDays)}`}
                </span>
                {card.lapses > 0 && (
                  <span className="text-warn">
                    {card.lapses} herë e harruar
                  </span>
                )}
                {card.source !== "manual" && <span>Nga AI</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(card.id)}
              aria-label="Fshi kartën"
              className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-bad-soft hover:text-bad"
            >
              <Trash2 size={15} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Creating cards
   ============================================================ */

function NewCardModal({
  subjects,
  defaultSubjectId,
  onClose,
  onSaved,
}: {
  subjects: { id: string; name: string }[];
  defaultSubjectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!front.trim() || !back.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: [{ front, back, subjectId: subjectId || null }],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Nuk u ruajt dot.");
        return;
      }
      onSaved();
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Kartë e re">
      <div className="flex flex-col gap-3">
        <Field label="Pyetja">
          <Input
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Çfarë është integrali i caktuar?"
            autoFocus
          />
        </Field>
        <Field label="Përgjigjja">
          <Textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={3}
            placeholder="Sipërfaqja nën kurbë midis dy kufijve…"
          />
        </Field>
        {subjects.length > 0 && (
          <Field label="Lënda">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Pa lëndë</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {error && <p className="text-[13px] text-bad">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Anulo
          </Button>
          <Button onClick={save} disabled={busy || !front.trim() || !back.trim()}>
            {busy ? "Po ruaj…" : "Ruaj kartën"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function GenerateModal({
  subjects,
  materials,
  defaultSubjectId,
  onClose,
  onGenerated,
}: {
  subjects: { id: string; name: string }[];
  materials: { id: string; title: string; subjectId: string | null }[];
  defaultSubjectId: string;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || "");
  const [materialId, setMaterialId] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usable = materials.filter((m) => !subjectId || m.subjectId === subjectId);

  const generate = async () => {
    if (!subjectId) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          count,
          ...(materialId ? { materialId } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "AI nuk u përgjigj. Provo përsëri.");
        return;
      }
      onGenerated();
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  };

  if (!subjects.length) {
    return (
      <Modal open onClose={onClose} title="Gjenero karta">
        <p className="text-[13.5px] text-muted">
          Shto së pari një lëndë — AI ka nevojë të dijë për çfarë po krijon karta.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Gjenero karta me AI">
      <div className="flex flex-col gap-3">
        <Field label="Lënda">
          <Select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setMaterialId("");
            }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        {usable.length > 0 && (
          <Field
            label="Nga një material"
            hint="Lëre bosh që AI të bazohet te temat e lëndës."
          >
            <Select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              <option value="">Nga temat e lëndës</option>
              {usable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Sa karta">
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </Field>

        {error && <p className="text-[13px] text-bad">{error}</p>}

        <p className="text-[12.5px] leading-relaxed text-faint">
          Kartat i shtohen dekut tënd dhe janë të tuat — mund t&apos;i ndryshosh
          ose t&apos;i fshish më pas.
        </p>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Anulo
          </Button>
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Po krijoj…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Gjenero
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
