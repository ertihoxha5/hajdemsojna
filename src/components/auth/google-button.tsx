"use client";

import { useState } from "react";

/**
 * Sign in with Google.
 *
 * A plain link to the route that starts the flow, not a fetch: OAuth is a
 * full-page navigation, and anything cleverer would just have to undo itself.
 *
 * The button is rendered only when the server says Google is configured, so
 * it can never be a dead control — an app with no client id simply does not
 * show it.
 */
export function GoogleButton({
  next,
  label = "Vazhdo me Google",
}: {
  next?: string;
  label?: string;
}) {
  const [going, setGoing] = useState(false);

  const href = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  return (
    <a
      href={href}
      onClick={() => setGoing(true)}
      aria-disabled={going}
      className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-line bg-surface text-[14.5px] font-medium text-ink transition-colors hover:border-brand/60 hover:bg-sunken"
    >
      {going ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" />
      ) : (
        <GoogleMark />
      )}
      {going ? "Duke hapur Google…" : label}
    </a>
  );
}

/** Google's mark, in its own four colours. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

/** The "or" rule between Google and the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[12px] text-faint">ose</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
