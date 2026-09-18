import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { randomToken } from "./crypto";

/**
 * Email confirmation, on the same VerificationToken table as password reset.
 *
 * Deliberately not a gate. A student who signed up to plan tomorrow's revision
 * should not be locked out because a confirmation mail is slow or went to spam;
 * an unconfirmed address only means we will not send them anything important
 * and the app says so once, in a banner they can dismiss by confirming.
 *
 * Tokens are hashed at rest and single-use, for the same reasons as in
 * src/lib/password-reset.ts. The scope prefix is what keeps the two flows from
 * ever accepting each other's tokens.
 */

const TOKEN_TTL_HOURS = 48;
const SCOPE = "email-verify";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function identifierFor(email: string): string {
  return `${SCOPE}:${email.toLowerCase()}`;
}

export interface VerifyRequest {
  token: string;
  expires: Date;
}

/** Issues a confirmation link, or null when the address is already confirmed. */
export async function requestEmailVerification(
  email: string
): Promise<VerifyRequest | null> {
  const normalised = email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email: normalised },
    select: { emailVerified: true },
  });

  if (!user || user.emailVerified) return null;

  const identifier = identifierFor(normalised);
  await db.verificationToken.deleteMany({ where: { identifier } });

  const token = randomToken();
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000);

  await db.verificationToken.create({
    data: { identifier, token: hashToken(token), expires },
  });

  return { token, expires };
}

export type VerifyOutcome =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Spends the token and marks the address confirmed.
 *
 * The row is deleted before the user is updated, so two clicks on the same
 * link cannot both count as a fresh confirmation.
 */
export async function confirmEmail(token: string): Promise<VerifyOutcome> {
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

  const deleted = await db.verificationToken.deleteMany({
    where: { token: row.token },
  });
  if (deleted.count === 0) return { ok: false, reason: "invalid" };

  const email = row.identifier.slice(SCOPE.length + 1);
  const updated = await db.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  });

  if (updated.count === 0) return { ok: false, reason: "invalid" };

  return { ok: true, email };
}
