import "server-only";
import { db } from "@/lib/db";
import type { GoogleProfile, GoogleTokens } from "@/lib/oauth/google";
import { OAuthError } from "@/lib/oauth/google";

/**
 * Turning a Google profile into a user of this app.
 *
 * Deliberately free of any network call, so the decisions below — which are
 * the security-sensitive part — can be tested exhaustively.
 *
 * Three cases, in order:
 *
 *   1. We have seen this Google account before. Sign them in. The match is on
 *      Google's `sub`, never the email, because people change addresses and a
 *      reused address must not inherit someone else's account.
 *
 *   2. No linked account, but a user already holds that email. Link them —
 *      but only if Google says the address is verified. This is the one place
 *      where getting it wrong is an account takeover: if unverified addresses
 *      were accepted, anyone who could persuade an identity provider to issue
 *      a token for `someone@example.com` would inherit that user's account.
 *
 *   3. Nobody has it. Create the account, already confirmed, because Google
 *      has done the confirming.
 */

export type LinkOutcome =
  | { kind: "signed-in"; userId: string; onboarded: boolean }
  | { kind: "linked"; userId: string; onboarded: boolean }
  | { kind: "created"; userId: string; onboarded: boolean };

/** Everything stored about the Google side of a link. */
function accountData(profile: GoogleProfile, tokens: GoogleTokens) {
  return {
    type: "oauth",
    provider: "google",
    providerAccountId: profile.sub,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    id_token: tokens.idToken,
    expires_at: tokens.expiresAt,
    token_type: tokens.tokenType,
    scope: tokens.scope,
  };
}

export async function resolveGoogleUser(
  profile: GoogleProfile,
  tokens: GoogleTokens
): Promise<LinkOutcome> {
  /* 1. Already linked. */
  const existing = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: profile.sub,
      },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { profile: { select: { onboardedAt: true } } } },
    },
  });

  if (existing) {
    // Refresh the stored tokens. Google omits the refresh token on repeat
    // consents, so an absent one must not wipe the one we hold.
    await db.account.update({
      where: { id: existing.id },
      data: {
        access_token: tokens.accessToken,
        id_token: tokens.idToken,
        expires_at: tokens.expiresAt,
        token_type: tokens.tokenType,
        scope: tokens.scope,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      },
    });

    return {
      kind: "signed-in",
      userId: existing.userId,
      onboarded: Boolean(existing.user.profile?.onboardedAt),
    };
  }

  /* 2. Same address, existing account. */
  const byEmail = await db.user.findUnique({
    where: { email: profile.email },
    select: { id: true, profile: { select: { onboardedAt: true } } },
  });

  if (byEmail) {
    if (!profile.emailVerified) {
      // The takeover case. Refuse rather than link, and say why.
      throw new OAuthError(
        "Google nuk e ka konfirmuar këtë adresë, prandaj nuk mund ta lidhim me llogarinë ekzistuese.",
        "unverified_email"
      );
    }

    await db.account.create({
      data: { userId: byEmail.id, ...accountData(profile, tokens) },
    });

    // Google has confirmed the address, so our own banner can stop asking.
    await db.user.update({
      where: { id: byEmail.id },
      data: { emailVerified: new Date() },
    });

    return {
      kind: "linked",
      userId: byEmail.id,
      onboarded: Boolean(byEmail.profile?.onboardedAt),
    };
  }

  /* 3. Brand new. */
  const created = await db.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      surname: profile.familyName,
      image: profile.picture,
      // No passwordHash: this account signs in through Google. They can set
      // a password later through the reset flow if they want both.
      emailVerified: profile.emailVerified ? new Date() : null,
      profile: { create: {} },
      settings: { create: {} },
      preference: { create: {} },
      accounts: { create: accountData(profile, tokens) },
    },
    select: { id: true },
  });

  return { kind: "created", userId: created.id, onboarded: false };
}

/** The providers linked to an account, for the settings screen. */
export async function linkedProviders(userId: string): Promise<string[]> {
  const rows = await db.account.findMany({
    where: { userId },
    select: { provider: true },
  });
  return rows.map((r) => r.provider);
}

/**
 * Unlinks a provider.
 *
 * Refused when it would leave the account with no way in at all — a user
 * with no password and no remaining provider would be locked out of their
 * own data by a single click.
 */
export async function unlinkProvider(
  userId: string,
  provider: string
): Promise<void> {
  const [user, accounts] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    }),
    db.account.findMany({ where: { userId }, select: { id: true, provider: true } }),
  ]);

  const remaining = accounts.filter((a) => a.provider !== provider);
  if (!user.passwordHash && remaining.length === 0) {
    throw new OAuthError(
      "Cakto një fjalëkalim para se ta heqësh Google — përndryshe nuk hyn dot më.",
      "would_lock_out"
    );
  }

  await db.account.deleteMany({ where: { userId, provider } });
}
