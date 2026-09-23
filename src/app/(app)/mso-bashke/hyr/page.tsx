"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { environmentFor } from "@/lib/spaces/environments";
import { Button, Card } from "@/components/ui";

/**
 * The landing page for an invite link.
 *
 * It shows what the room is and what its rules are before anyone joins, which
 * is the whole reason the code lookup returns a small summary rather than
 * joining outright. Nobody should be dropped into a room they have not seen.
 */
export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-[13.5px] text-muted">
          Një moment…
        </div>
      }
    >
      <JoinInner />
    </Suspense>
  );
}

interface Preview {
  id: string;
  name: string;
  about: string;
  subjectName: string;
  environment: string;
  privacy: string;
  memberCount: number;
  maxMembers: number;
  locked: boolean;
  rules: string[];
}

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();

  const code = params.get("kod") ?? "";
  const spaceId = params.get("space") ?? "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const look = useCallback(async (): Promise<
    { preview: Preview | null; error: string | null }
  > => {
    // Arrived by space id: a public room can still be joined, but there is
    // nothing to look up without a code.
    if (!code) return { preview: null, error: null };

    try {
      const res = await fetch(`/api/spaces/join?code=${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      return res.ok
        ? { preview: data.space as Preview, error: null }
        : { preview: null, error: data.error ?? "Kodi nuk u gjet." };
    } catch {
      return { preview: null, error: "Lidhja dështoi." };
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;

    void look().then((result) => {
      if (cancelled) return;
      if (result.preview) setPreview(result.preview);
      if (result.error) setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [look]);

  const join = async () => {
    setBusy(true);
    setError(null);

    try {
      // With a code, join through the code. Otherwise this is a public room
      // reached by id, and the server decides whether that is allowed.
      const res = code
        ? await fetch("/api/spaces/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })
        : await fetch(`/api/spaces/${spaceId}/join`, { method: "POST" });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nuk u bashkove dot.");
        return;
      }

      router.push(`/mso-bashke/${data.spaceId ?? spaceId}`);
    } catch {
      setError("Lidhja dështoi.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[13.5px] text-muted">
        <Loader2 size={15} className="animate-spin" />
        Po e kërkoj hapësirën…
      </div>
    );
  }

  const env = environmentFor(preview?.environment ?? "biblioteka");

  return (
    <div className="mx-auto max-w-md py-10">
      <Card padded={false} className="overflow-hidden">
        <div
          className="h-28 w-full"
          style={{
            background: `radial-gradient(90% 80% at 50% 8%, ${env.palette.glow}55 0%, ${env.palette.wall} 45%, ${env.palette.floor} 100%)`,
          }}
        />

        <div className="p-5">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
            {preview?.name ?? "Hapësirë studimi"}
          </h1>

          <p className="mt-1 text-[13px] text-muted">
            {env.name}
            {preview?.subjectName ? ` · ${preview.subjectName}` : ""}
          </p>

          {preview?.about && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {preview.about}
            </p>
          )}

          {preview && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink">
              <Users size={14} className="text-muted" />
              {preview.memberCount}/{preview.maxMembers} studentë
            </p>
          )}

          {preview && preview.rules.length > 0 && (
            <div className="mt-4 rounded-[10px] border border-line bg-sunken p-3">
              <p className="text-[12.5px] font-medium text-ink">
                Rregullat e hapësirës
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {preview.rules.map((rule) => (
                  <li key={rule} className="text-[12.5px] text-muted">
                    • {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-[10px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => router.push("/mso-bashke")}
            >
              Jo tani
            </Button>
            <Button
              className="flex-1"
              disabled={busy || preview?.locked}
              onClick={join}
            >
              {busy ? "Po hyj…" : preview?.locked ? "E mbyllur" : "Hyr"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
