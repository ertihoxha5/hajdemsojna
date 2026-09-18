"use client";

import { useCallback, useEffect, useState } from "react";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Tells a student their address is unconfirmed, and offers to send the link
 * again.
 *
 * It renders nothing until the check comes back, and nothing at all once the
 * address is confirmed — a banner that flashes on every page load for the
 * majority of users who are fine would be worse than no banner.
 */
export function VerifyEmailBanner() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "verified" }
    | { status: "unverified"; email: string }
  >({ status: "loading" });

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<"sent" | "logged" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/verify")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setState(
          data.verified
            ? { status: "verified" }
            : { status: "unverified", email: data.email }
        );
      })
      .catch(() => {
        // Offline: say nothing rather than claim the address is unconfirmed.
        if (!cancelled) setState({ status: "verified" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resend = useCallback(async () => {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/account/verify", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Nuk u dërgua dot. Provo përsëri.");
        return;
      }
      if (data.verified) {
        setState({ status: "verified" });
        return;
      }
      setSent(data.logged ? "logged" : "sent");
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setSending(false);
    }
  }, []);

  if (state.status !== "unverified") return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3">
      <MailWarning size={16} className="shrink-0 text-warn" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">
          Email-i nuk është konfirmuar
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
          {sent === "logged"
            ? "Nuk ka shërbim email-i të konfiguruar — linku u shkrua në konsolën e serverit."
            : sent === "sent"
              ? `E dërguam përsëri te ${state.email}.`
              : `Konfirmo ${state.email} që të marrësh njoftimet për afate dhe provime.`}
        </p>
        {error && <p className="mt-1 text-[12.5px] text-bad">{error}</p>}
      </div>

      {!sent && (
        <Button size="sm" variant="secondary" onClick={resend} disabled={sending}>
          {sending ? "Po dërgoj…" : "Dërgo linkun"}
        </Button>
      )}
    </div>
  );
}
