import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { randomToken } from "./crypto";

/**
 * Password reset, built on the VerificationToken table the schema already had.
 *
 * Two rules shape this file:
 *
 *   1. The token is stored as a SHA-256 hash, never in the clear. Someone who
 *      can read the database can already do worse than reset a password, but a
 *      leaked backup or a stray log line should not hand over live reset links.
 *      The plaintext exists only in the link sent to the student.
 *
 *   2. Nothing here ever reveals whether an address has an account. The caller
 *      gets the same answer either way; see requestPasswordReset.
 *
 * Tokens are single-use and short-lived, and using one signs out every other
 * session — a reset is how you recover a compromised account, so the sessions
 * an attacker may hold have to die with it.
 */

const TOKEN_TTL_MINUTES = 60;

/** `identifier` on VerificationToken, namespaced so other flows can share it. */
const SCOPE = "password-reset";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function identifierFor(email: string): string {
  return `${SCOPE}:${email.toLowerCase()}`;
}

export interface ResetRequest {
  /** The plaintext token. Goes in the link and is never stored. */
  token: string;
  expires: Date;
}

/**
 * Issues a reset token for an address, or null when no account has it.
 *
 * Callers must not turn that null into a different user-facing message — the
 * route is responsible for answering identically either way.
 */
export async function requestPasswordReset(
  email: string
): Promise<ResetRequest | null> {
  const normalised = email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email: normalised },
    select: { id: true, passwordHash: true },
  });

  // An account with no password is an OAuth-only account; there is nothing to
  // reset, and saying so would leak that the address exists.
  if (!user?.passwordHash) return null;

  const identifier = identifierFor(normalised);

  // Only the newest link should work, so previous ones are dropped.
  await db.verificationToken.deleteMany({ where: { identifier } });

  const token = randomToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await db.verificationToken.create({
    data: { identifier, token: hashToken(token), expires },
  });

  return { token, expires };
}

export type ResetOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Checks a token without consuming it — used to decide whether the reset form
 * is worth showing at all.
 */
export async function checkResetToken(token: string): Promise<ResetOutcome> {
  if (!token) return { ok: false, reason: "invalid" };

  const row = await db.verificationToken.findUnique({
    where: { token: hashToken(token) },
  });

  if (!row || !row.identifier.startsWith(`${SCOPE}:`)) {
    return { ok: false, reason: "invalid" };
  }

  if (row.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { token: row.token } });
    return { ok: false, reason: "expired" };
  }

  const email = row.identifier.slice(SCOPE.length + 1);
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: false, reason: "invalid" };

  return { ok: true, userId: user.id };
}

/**
 * Spends the token and sets the new password.
 *
 * The token row is deleted before the password is written, so two requests
 * racing on the same link cannot both succeed.
 */
export async function consumeResetToken(token: string): Promise<ResetOutcome> {
  const checked = await checkResetToken(token);
  if (!checked.ok) return checked;

  const deleted = await db.verificationToken.deleteMany({
    where: { token: hashToken(token) },
  });

  // Lost the race: another request already spent this token.
  if (deleted.count === 0) return { ok: false, reason: "invalid" };

  return checked;
}

/** Throws away every reset link outstanding for an address. */
export async function clearResetTokens(email: string): Promise<void> {
  await db.verificationToken.deleteMany({
    where: { identifier: identifierFor(email) },
  });
}

/** Housekeeping for expired rows; safe to call on any reset request. */
export async function purgeExpiredTokens(): Promise<void> {
  await db.verificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  });
}
