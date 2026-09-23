"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { AMBIENCES, ambienceFor } from "@/lib/spaces/environments";
import { Select, cx } from "@/components/ui";

/**
 * Personal ambience.
 *
 * Personal is the default on purpose: a shared room is not a shared pair of
 * headphones. One student concentrates to rain and another to silence, and
 * making them agree helps neither. A host can sync it, and when they do this
 * follows the room instead.
 *
 * Kept entirely separate from any voice audio, so turning the rain down never
 * turns a person down.
 */

const STORAGE_KEY = "hm.ambience";

/* ============================================================
   Stored preferences
   ============================================================ */

/**
 * The student's saved ambience settings, as a tiny external store.
 *
 * useSyncExternalStore rather than "read localStorage in an effect": it gives
 * the server and the first client render the same value, so hydration stays
 * consistent, and it costs no extra render pass. Changes in another tab
 * arrive for free through the storage event.
 */

export interface AmbiencePrefs {
  choice: string | null;
  volume: number;
  muted: boolean;
}

const DEFAULTS: AmbiencePrefs = { choice: null, volume: 0.4, muted: false };

/** Snapshots must be referentially stable or React re-renders forever. */
let cachedRaw: string | null = null;
let cachedPrefs: AmbiencePrefs = DEFAULTS;

const listeners = new Set<() => void>();

function readPrefs(): AmbiencePrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private window or blocked storage: the defaults are fine.
    return DEFAULTS;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedPrefs = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      cachedPrefs = DEFAULTS;
    }
  }
  return cachedPrefs;
}

/** There is no localStorage on the server, so everyone starts at defaults. */
function serverPrefs(): AmbiencePrefs {
  return DEFAULTS;
}

function subscribePrefs(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writePrefs(next: AmbiencePrefs): void {
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedPrefs = next;
  } catch {
    // Still notify: the setting should apply for this session even when it
    // cannot be persisted.
    cachedPrefs = next;
  }
  // A same-tab write fires no storage event, so tell the subscribers here.
  for (const listener of listeners) listener();
}

export function AmbiencePlayer({
  roomAmbient,
  synced,
  suggests,
}: {
  roomAmbient: string;
  synced: boolean;
  suggests: string[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);

  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, serverPrefs);

  // When the host syncs the room, the room wins. Derived during render, so
  // there is no effect reaching in to overwrite a piece of state.
  const choice = synced ? roomAmbient : prefs.choice ?? roomAmbient;
  const { volume, muted } = prefs;

  const setChoice = useCallback(
    (next: string) => writePrefs({ ...readPrefs(), choice: next }),
    []
  );
  const setVolume = useCallback(
    (next: number) => writePrefs({ ...readPrefs(), volume: next }),
    []
  );
  const setMuted = useCallback(
    (next: boolean) => writePrefs({ ...readPrefs(), muted: next }),
    []
  );

  const active = ambienceFor(choice);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = muted ? 0 : volume;

    if (!active.file || muted) {
      audio.pause();
      return;
    }

    // Browsers refuse audio until the page has been interacted with. That is
    // a real state, so it is shown rather than silently swallowed.
    audio.play().then(
      () => setBlocked(false),
      () => setBlocked(true)
    );
  }, [active.file, muted, volume]);

  const options = [
    ...suggests.filter((s) => AMBIENCES.some((a) => a.key === s)),
    ...AMBIENCES.map((a) => a.key).filter((k) => !suggests.includes(k)),
  ];

  return (
    <div className="flex flex-col gap-2">
      {active.file && (
        <audio
          ref={audioRef}
          src={active.file}
          loop
          preload="none"
          aria-label={`Ambienti: ${active.name}`}
        />
      )}

      <div className="flex items-center gap-2">
        <Select
          value={choice}
          disabled={synced}
          onChange={(e) => setChoice(e.target.value)}
          aria-label="Zgjidh ambientin"
          className="h-8 flex-1 text-[13px]"
        >
          {options.map((key) => {
            const a = ambienceFor(key);
            return (
              <option key={key} value={key}>
                {a.name}
              </option>
            );
          })}
        </Select>

        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "Hiq heshtjen" : "Hesht ambientin"}
          aria-pressed={muted}
          className={cx(
            "rounded-lg border border-line p-1.5 transition-colors",
            muted ? "text-faint" : "text-ink hover:border-brand"
          )}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={muted}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volumi i ambientit"
        className="h-1 w-full accent-[var(--brand)]"
      />

      {synced && (
        <p className="text-[11.5px] text-faint">
          Host-i e ka sinkronizuar ambientin për të gjithë.
        </p>
      )}
      {blocked && active.file && !muted && (
        <p className="text-[11.5px] text-warn">
          Shfletuesi e bllokoi audion. Kliko diku në faqe për ta nisur.
        </p>
      )}
    </div>
  );
}
