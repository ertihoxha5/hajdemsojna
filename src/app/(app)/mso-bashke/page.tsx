"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, KeyRound, Loader2, Plus, Users } from "lucide-react";
import { environmentFor } from "@/lib/spaces/environments";
import { clock } from "@/lib/spaces/session";
import { Button, Card, EmptyState, Field, Input, Modal, useToast } from "@/components/ui";

/**
 * Mso Bashkë.
 *
 * Rooms are shown as lit thumbnails in horizontal rails rather than as a card
 * grid, because the interesting thing about a space is whether it is alive —
 * who is in it and how far through a round they are. A grid of equal boxes
 * flattens exactly that.
 */

interface SpaceCard {
  id: string;
  name: string;
  subjectName: string;
  environment: string;
  privacy: string;
  memberCount: number;
  maxMembers: number;
  isMember: boolean;
  session: {
    mode: string;
    round: number;
    totalRounds: number;
    remaining: number;
  } | null;
  topic: string;
  groupFocus: number;
}

interface Discovery {
  mine: SpaceCard[];
  live: SpaceCard[];
  publicSpaces: SpaceCard[];
  recommended: SpaceCard[];
}

export default function SpacesPage() {
  const router = useRouter();
  const [data, setData] = useState<Discovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);

  const fetchSpaces = useCallback(async (): Promise<Discovery | null> => {
    try {
      const res = await fetch("/api/spaces");
      const json = await res.json().catch(() => ({}));
      return res.ok ? (json as Discovery) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchSpaces().then((next) => {
      if (cancelled) return;
      if (next) setData(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchSpaces]);

  const empty =
    data &&
    !data.mine.length &&
    !data.publicSpaces.length &&
    !data.recommended.length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink sm:text-[30px]">
            Mso Bashkë
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Gjej një hapësirë. Hyr me shokë. Fokusohuni së bashku.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setJoinOpen(true)}>
            <KeyRound size={14} />
            Bashkohu me kod
          </Button>
          <Button variant="primary" onClick={() => router.push("/mso-bashke/krijo")}>
            <Plus size={14} />
            Krijo Study Space
          </Button>
        </div>
      </header>

      {loading && !data ? (
        <Card className="flex items-center justify-center gap-2 py-16 text-[13.5px] text-muted">
          <Loader2 size={15} className="animate-spin" />
          Po ngarkoj hapësirat…
        </Card>
      ) : empty ? (
        <FirstTime onJoin={() => setJoinOpen(true)} />
      ) : (
        <>
          <Rail
            title="Duke ndodhur tani"
            hint="Raunde në zhvillim e sipër."
            spaces={data?.live ?? []}
          />
          <Rail
            title="Spaces e mia"
            hint="Dhomat ku je anëtar."
            spaces={data?.mine ?? []}
          />
          <Rail
            title="Të rekomanduara për ty"
            hint="Publike, në lëndët që ke ti."
            spaces={data?.recommended ?? []}
          />
          <Rail
            title="Spaces publike"
            hint="Të hapura për këdo."
            spaces={data?.publicSpaces ?? []}
          />
        </>
      )}

      {joinOpen && (
        <JoinModal
          onClose={() => setJoinOpen(false)}
          onJoined={(id) => router.push(`/mso-bashke/${id}`)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Rails
   ============================================================ */

function Rail({
  title,
  hint,
  spaces,
}: {
  title: string;
  hint: string;
  spaces: SpaceCard[];
}) {
  if (!spaces.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-ink">
            {title}
          </h2>
          <p className="text-[12.5px] text-muted">{hint}</p>
        </div>
        <span className="num text-[12px] text-faint">{spaces.length}</span>
      </div>

      {/* Horizontal rail: rooms scroll sideways so a long list never pushes
          the rest of the page off the screen. */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {spaces.map((space) => (
          <SpaceTile key={`${title}-${space.id}`} space={space} />
        ))}
      </div>
    </section>
  );
}

function SpaceTile({ space }: { space: SpaceCard }) {
  const env = environmentFor(space.environment);
  const live = space.session && space.session.mode !== "ended";

  return (
    <Link
      href={
        space.isMember
          ? `/mso-bashke/${space.id}`
          : `/mso-bashke/hyr?space=${space.id}`
      }
      className="group w-[248px] shrink-0 snap-start overflow-hidden rounded-[14px] border border-line bg-surface transition-all hover:border-brand/60 hover:shadow-md"
    >
      {/* The thumbnail is the room's real palette, so it is recognisable. */}
      <div
        className="relative h-24 w-full"
        style={{
          background: `radial-gradient(90% 80% at 50% 8%, ${env.palette.glow}55 0%, ${env.palette.wall} 45%, ${env.palette.floor} 100%)`,
        }}
      >
        {live && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-bad" />
            Live
          </span>
        )}

        <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white">
          {space.privacy === "public"
            ? "Publike"
            : space.privacy === "friends"
              ? "Shokët"
              : "Private"}
        </span>

        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white">
          <Users size={10} />
          {space.memberCount}/{space.maxMembers}
        </span>
      </div>

      <div className="p-3">
        <p className="truncate text-[14px] font-medium text-ink">{space.name}</p>
        <p className="truncate text-[12px] text-muted">
          {env.name}
          {space.subjectName ? ` · ${space.subjectName}` : ""}
        </p>

        {live && space.session ? (
          <p className="num mt-2 text-[12.5px] text-ink">
            {space.session.mode === "focus" ? "Fokus" : "Pushim"}{" "}
            {clock(space.session.remaining)}
            <span className="text-faint">
              {" "}
              · raundi {space.session.round}/{space.session.totalRounds}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] text-faint">Pa sesion aktiv</p>
        )}

        {space.topic && (
          <p className="mt-1 truncate text-[12px] text-muted">
            Tema: {space.topic}
          </p>
        )}

        {space.memberCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${space.groupFocus}%` }}
              />
            </div>
            <span className="num text-[11px] text-faint">{space.groupFocus}%</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ============================================================
   Empty state and joining
   ============================================================ */

function FirstTime({ onJoin }: { onJoin: () => void }) {
  return (
    <EmptyState
      icon={<Compass size={24} />}
      title="Studimi është më i lehtë kur nuk je vetëm."
      body="Krijo një hapësirë, hyr në një publike, ose përdor kodin që të dha një shok."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/mso-bashke/krijo">
            <Button variant="primary">
              <Plus size={14} />
              Krijo Study Space
            </Button>
          </Link>
          <Button onClick={onJoin}>
            <KeyRound size={14} />
            Bashkohu me kod
          </Button>
        </div>
      }
    />
  );
}

function JoinModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (spaceId: string) => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    name: string;
    subjectName: string;
    memberCount: number;
    maxMembers: number;
    rules: string[];
  } | null>(null);

  // Look the code up before joining, so the rules can be read first.
  const look = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/spaces/join?code=${encodeURIComponent(code.trim())}`
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Kodi nuk u gjet.");
        return;
      }
      setPreview(data.space);
    } catch {
      setError("Lidhja dështoi.");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/spaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Nuk u bashkove dot.");
        return;
      }

      toast("Mirë se erdhe!");
      onJoined(data.spaceId);
    } catch {
      setError("Lidhja dështoi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Bashkohu me kod">
      <div className="flex flex-col gap-3">
        <Field label="Kodi i hapësirës" hint="Gjashtë karaktere, p.sh. HM7X92.">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setPreview(null);
            }}
            placeholder="AX72Q9"
            maxLength={8}
            autoFocus
            className="num tracking-[0.2em]"
          />
        </Field>

        {preview && (
          <div className="rounded-[10px] border border-line bg-sunken p-3">
            <p className="text-[13.5px] font-medium text-ink">{preview.name}</p>
            <p className="text-[12.5px] text-muted">
              {preview.memberCount}/{preview.maxMembers} studentë
              {preview.subjectName ? ` · ${preview.subjectName}` : ""}
            </p>

            {preview.rules.length > 0 && (
              <>
                <p className="mt-2 text-[12px] font-medium text-ink">Rregullat</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {preview.rules.map((r) => (
                    <li key={r} className="text-[12px] text-muted">
                      • {r}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {error && <p className="text-[13px] text-bad">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Anulo
          </Button>
          <Button
            disabled={busy || code.trim().length < 6}
            onClick={preview ? join : look}
          >
            {busy ? "Një moment…" : preview ? "Hyr" : "Kontrollo kodin"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
