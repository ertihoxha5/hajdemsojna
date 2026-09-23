/**
 * What a failed Google round trip is called, in Albanian.
 *
 * A plain module with no "use client" and no "server-only", because both
 * sides need it: the sign-in and sign-up pages are Server Components that
 * render the message, and the callback route produces the codes.
 *
 * It lived in the client component next to the button, which meant the
 * server calling it crashed the page — a client module's exports can only be
 * rendered as components or passed as props, never invoked from the server.
 */

const REASONS: Record<string, string> = {
  google_off: "Hyrja me Google nuk është e aktivizuar në këtë instalim.",
  cancelled: "E anulove hyrjen me Google.",
  expired: "Kërkesa skadoi. Provo përsëri.",
  bad_state: "Kërkesa nuk përputhi. Provo përsëri nga kjo faqe.",
  bad_nonce: "Kërkesa nuk përputhi. Provo përsëri nga kjo faqe.",
  missing_code: "Google nuk ktheu një kod. Provo përsëri.",
  token_exchange: "Shkëmbimi me Google dështoi. Provo përsëri.",
  bad_token: "Identiteti nga Google nuk u verifikua.",
  no_email: "Kjo llogari Google nuk ka një email të përdorshëm.",
  unverified_email:
    "Google nuk e ka konfirmuar këtë adresë, prandaj nuk e lidhëm dot me llogarinë ekzistuese. Kyçu me fjalëkalim.",
  not_configured: "Hyrja me Google nuk është e aktivizuar në këtë instalim.",
  failed: "Hyrja me Google dështoi. Provo përsëri.",
};

/**
 * The callback can only redirect, so it passes a short code rather than a
 * message. An unrecognised code still says something useful.
 */
export function oauthErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return REASONS[code] ?? REASONS.failed;
}
