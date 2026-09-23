import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google sign-in, as the plain authorization-code flow it is.
 *
 * No OAuth library: the whole exchange is two HTTPS calls and a signature
 * check, and `jose` already ships in this project for the JWT part. A
 * dependency here would mostly be configuration indirection.
 *
 * Everything that talks to Google lives in this file, so the account logic in
 * src/server/oauth.ts is testable without a network.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Google rotates signing keys; jose caches the set and refetches on miss. */
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export class OAuthError extends Error {
  code: string;
  constructor(message: string, code = "oauth_failed") {
    super(message);
    this.name = "OAuthError";
    this.code = code;
  }
}

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

/**
 * The redirect URI, which must match what is registered in Google Cloud
 * exactly — including the scheme and any port.
 */
export function googleRedirectUri(): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export interface AuthUrlInput {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export function buildAuthUrl(input: AuthUrlInput): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new OAuthError("Google nuk është konfiguruar.", "not_configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    // Only what is actually used: who they are and their address. No Drive,
    // no contacts, nothing this app has no business reading.
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    // Ask for an account picker rather than silently reusing whichever
    // Google session the browser happens to hold.
    prompt: "select_account",
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string;
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
}

export async function exchangeCode(
  code: string,
  codeVerifier: string
): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OAuthError("Google nuk është konfiguruar.", "not_configured");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    // The body can echo the code and the client id, so it is not logged raw.
    console.error("[google] token exchange failed", response.status);
    throw new OAuthError("Shkëmbimi me Google dështoi.", "token_exchange");
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  if (!data.access_token || !data.id_token) {
    throw new OAuthError("Google ktheu një përgjigje të paplotë.", "bad_response");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    idToken: data.id_token,
    expiresAt: data.expires_in
      ? Math.floor(Date.now() / 1000) + data.expires_in
      : null,
    tokenType: data.token_type ?? null,
    scope: data.scope ?? null,
  };
}

export interface GoogleProfile {
  /** Google's stable id for the account. Never the email — people change those. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture: string | null;
}

/**
 * Verifies the ID token and reads the profile out of it.
 *
 * The token arrives straight from Google's token endpoint over TLS, so
 * checking the signature is belt and braces — but it also checks the
 * issuer, the audience and the nonce, and those are the parts that matter.
 * A token minted for a different client or a different request must not be
 * accepted here.
 */
export async function verifyIdToken(
  idToken: string,
  expectedNonce: string
): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new OAuthError("Google nuk është konfiguruar.", "not_configured");

  let payload;
  try {
    const verified = await jwtVerify(idToken, jwks, {
      issuer: ISSUERS,
      audience: clientId,
      // Google's tokens are short-lived; a minute of clock drift is plenty.
      clockTolerance: 60,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (error) {
    console.error("[google] id token rejected", error);
    throw new OAuthError("Identiteti nga Google nuk u verifikua.", "bad_token");
  }

  if (payload.nonce !== expectedNonce) {
    throw new OAuthError("Kërkesa nuk përputhet.", "bad_nonce");
  }

  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) {
    throw new OAuthError("Llogaria e Google nuk ka email.", "no_email");
  }

  const given = typeof payload.given_name === "string" ? payload.given_name : "";
  const family = typeof payload.family_name === "string" ? payload.family_name : "";
  const full = typeof payload.name === "string" ? payload.name : "";

  return {
    sub: String(payload.sub),
    email: email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: given || full.split(" ")[0] || email.split("@")[0],
    givenName: given,
    familyName: family || full.split(" ").slice(1).join(" "),
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
