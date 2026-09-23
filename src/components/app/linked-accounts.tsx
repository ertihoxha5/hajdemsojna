"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Which sign-in methods are attached to this account.
 *
 * Renders nothing at all when Google is not configured and nothing is
 * linked, so an installation without OAuth does not grow a settings section
 * about a feature it does not have.
 */

interface State {
  providers: string[];
  hasPassword: boolean;
  googleAvailable: boolean;
}

export function LinkedAccounts() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetches without touching state, so the mount effect stays state-free. */
  const fetchState = useCallback(async (): Promise<State | null> => {
    try {
      const res = await fetch("/api/account/providers");
      return res.ok ? ((await res.json()) as State) : null;
    } catch {
      // Offline: say nothing rather than claim nothing is linked.
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const next = await fetchState();
    if (next) setState(next);
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    void fetchState().then((next) => {
      if (!cancelled && next) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchState]);

  if (!state) return null;

  const hasGoogle = state.providers.includes("google");
  if (!hasGoogle && !state.googleAvailable) return null;

  const unlink = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/account/providers?provider=google", {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Nuk u hoq dot.");
        return;
      }
      await load();
    } catch {
      setError("Lidhja dështoi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-[13px] font-medium text-ink">Mënyrat e hyrjes</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        {state.hasPassword
          ? "Mund të hysh me fjalëkalim dhe me çdo llogari të lidhur."
          : "Kjo llogari hyn vetëm me Google. Cakto një fjalëkalim nëse do edhe mënyrën tjetër."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasGoogle ? (
          <>
            <span className="flex items-center gap-1.5 rounded-[9px] border border-ok/30 bg-ok-soft px-2.5 py-1.5 text-[12.5px] font-medium text-ok">
              <Link2 size={13} />
              Google e lidhur
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={unlink}
              title={
                state.hasPassword
                  ? undefined
                  : "Cakto një fjalëkalim së pari — përndryshe nuk hyn dot më."
              }
            >
              <Link2Off size={13} />
              {busy ? "Po e heq…" : "Hiqe"}
            </Button>
          </>
        ) : (
          <a href="/api/auth/google">
            <Button size="sm" variant="secondary" type="button">
              <Link2 size={13} />
              Lidhe me Google
            </Button>
          </a>
        )}
      </div>

      {error && <p className="mt-2 text-[12.5px] text-bad">{error}</p>}
    </div>
  );
}
