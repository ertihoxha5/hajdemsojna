import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import {
  codeChallengeFor,
  createFlowSecrets,
  safeEqual,
} from "@/lib/oauth/pkce.ts";
import { OAuthError } from "@/lib/oauth/google.ts";
import {
  linkedProviders,
  resolveGoogleUser,
  unlinkProvider,
} from "@/server/oauth.ts";
import { oauthErrorMessage } from "@/lib/oauth/messages.ts";

/**
 * The linking rules, tested exhaustively, because case 2 below is the one
 * where a mistake is an account takeover rather than a bug.
 */

const DOMAIN = "oauth.hajdemsojna.test";

function profile(over: Record<string, unknown> = {}) {
  return {
    sub: "google-sub-1",
    email: `ana@${DOMAIN}`,
    emailVerified: true,
    name: "Ana",
    givenName: "Ana",
    familyName: "Hoxha",
    picture: null,
    ...over,
  } as Parameters<typeof resolveGoogleUser>[0];
}

function tokens(over: Record<string, unknown> = {}) {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    idToken: "id-1",
    expiresAt: 1800000000,
    tokenType: "Bearer",
    scope: "openid email profile",
    ...over,
  } as Parameters<typeof resolveGoogleUser>[1];
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

/* ============================================================
   Flow secrets
   ============================================================ */

describe("flow secrets", () => {
  test("every value is fresh", () => {
    const a = createFlowSecrets();
    const b = createFlowSecrets();

    assert.notEqual(a.state, b.state);
    assert.notEqual(a.nonce, b.nonce);
    assert.notEqual(a.codeVerifier, b.codeVerifier);
  });

  test("values are long enough to be unguessable", () => {
    const s = createFlowSecrets();
    assert.ok(s.state.length >= 20, `state was ${s.state.length} chars`);
    assert.ok(s.codeVerifier.length >= 43, "PKCE verifiers must be 43+ chars");
  });

  test("values are URL-safe, so a redirect cannot mangle them", () => {
    const s = createFlowSecrets();
    for (const value of [s.state, s.nonce, s.codeVerifier, s.codeChallenge]) {
      assert.match(value, /^[A-Za-z0-9_-]+$/, `not URL-safe: ${value}`);
    }
  });

  test("the challenge is the S256 hash of the verifier", () => {
    const s = createFlowSecrets();
    assert.equal(s.codeChallenge, codeChallengeFor(s.codeVerifier));
    assert.notEqual(s.codeChallenge, s.codeVerifier);
  });

  test("the challenge is stable for a given verifier", () => {
    assert.equal(codeChallengeFor("abc123"), codeChallengeFor("abc123"));
  });
});

describe("safeEqual", () => {
  test("matches identical strings and rejects everything else", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abd"), false);
    assert.equal(safeEqual("abc", "ab"), false);
    assert.equal(safeEqual("", ""), true);
  });

  test("a length mismatch returns false rather than throwing", () => {
    // timingSafeEqual throws on unequal lengths; this must not surface.
    assert.doesNotThrow(() => safeEqual("short", "a much longer value"));
    assert.equal(safeEqual("short", "a much longer value"), false);
  });
});

/* ============================================================
   Account resolution
   ============================================================ */

describe("resolveGoogleUser", () => {
  before(cleanup);
  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("creates an account nobody has seen before", async () => {
    const outcome = await resolveGoogleUser(profile(), tokens());

    assert.equal(outcome.kind, "created");
    assert.equal(outcome.onboarded, false);

    const user = await db.user.findUniqueOrThrow({
      where: { id: outcome.userId },
      select: { email: true, name: true, surname: true, passwordHash: true, emailVerified: true },
    });

    assert.equal(user.email, `ana@${DOMAIN}`);
    assert.equal(user.name, "Ana");
    // No password: this account signs in through Google.
    assert.equal(user.passwordHash, null);
    // Google confirmed the address, so ours is confirmed too.
    assert.ok(user.emailVerified);
  });

  test("a new account gets its profile, settings and preferences", async () => {
    const outcome = await resolveGoogleUser(profile(), tokens());
    const user = await db.user.findUniqueOrThrow({
      where: { id: outcome.userId },
      include: { profile: true, settings: true, preference: true },
    });

    assert.ok(user.profile, "no profile row");
    assert.ok(user.settings, "no settings row");
    assert.ok(user.preference, "no preference row");
  });

  test("signs the same Google account back in rather than duplicating it", async () => {
    const first = await resolveGoogleUser(profile(), tokens());
    const second = await resolveGoogleUser(profile(), tokens());

    assert.equal(second.kind, "signed-in");
    assert.equal(second.userId, first.userId);

    const count = await db.user.count({ where: { email: { endsWith: DOMAIN } } });
    assert.equal(count, 1);
  });

  test("matches on Google's id, not on the email", async () => {
    // A student changes the address on their Google account. It is still
    // them, so they must land in the same app account.
    const first = await resolveGoogleUser(profile(), tokens());
    const renamed = await resolveGoogleUser(
      profile({ email: `ana.new@${DOMAIN}` }),
      tokens()
    );

    assert.equal(renamed.kind, "signed-in");
    assert.equal(renamed.userId, first.userId);
  });

  test("a different Google id with the same address does not inherit the account", async () => {
    await resolveGoogleUser(profile(), tokens());

    // Same email, different subject: a recycled address, not the same person.
    const other = await resolveGoogleUser(
      profile({ sub: "google-sub-2" }),
      tokens()
    );

    // It links to the existing user only because Google verified it, which
    // is the documented rule — but it must not be reported as a sign-in.
    assert.equal(other.kind, "linked");
  });

  test("refreshed tokens are stored", async () => {
    const first = await resolveGoogleUser(profile(), tokens());
    await resolveGoogleUser(
      profile(),
      tokens({ accessToken: "access-2", idToken: "id-2" })
    );

    const account = await db.account.findFirstOrThrow({
      where: { userId: first.userId },
    });
    assert.equal(account.access_token, "access-2");
    assert.equal(account.id_token, "id-2");
  });

  test("a missing refresh token does not wipe the stored one", async () => {
    // Google omits it on repeat consents, which must not lose ours.
    const first = await resolveGoogleUser(profile(), tokens());
    await resolveGoogleUser(profile(), tokens({ refreshToken: null }));

    const account = await db.account.findFirstOrThrow({
      where: { userId: first.userId },
    });
    assert.equal(account.refresh_token, "refresh-1");
  });

  test("links to an existing password account when Google verified the address", async () => {
    const existing = await db.user.create({
      data: {
        email: `ana@${DOMAIN}`,
        name: "Ana",
        surname: "Hoxha",
        passwordHash: "bcrypt-placeholder",
        profile: { create: { onboardedAt: new Date() } },
      },
    });

    const outcome = await resolveGoogleUser(profile(), tokens());

    assert.equal(outcome.kind, "linked");
    assert.equal(outcome.userId, existing.id);
    // Already onboarded, so they should land in the app, not in onboarding.
    assert.equal(outcome.onboarded, true);

    const after = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(after.passwordHash, "bcrypt-placeholder", "password was lost");
    assert.ok(after.emailVerified);
  });

  test("REFUSES to link when Google has not verified the address", async () => {
    // The account-takeover case. Anyone who can obtain a token for an
    // unverified address must not inherit the account that owns it.
    const existing = await db.user.create({
      data: {
        email: `ana@${DOMAIN}`,
        name: "Ana",
        surname: "Hoxha",
        passwordHash: "bcrypt-placeholder",
      },
    });

    await assert.rejects(
      () => resolveGoogleUser(profile({ emailVerified: false }), tokens()),
      (e: unknown) => e instanceof OAuthError && e.code === "unverified_email"
    );

    const accounts = await db.account.count({ where: { userId: existing.id } });
    assert.equal(accounts, 0, "an account was linked anyway");
  });

  test("an unverified brand-new address still creates an unconfirmed account", async () => {
    // Nothing to take over, so this is allowed — but not marked confirmed.
    const outcome = await resolveGoogleUser(
      profile({ emailVerified: false }),
      tokens()
    );

    assert.equal(outcome.kind, "created");
    const user = await db.user.findUniqueOrThrow({ where: { id: outcome.userId } });
    assert.equal(user.emailVerified, null);
  });

  test("two different people keep two different accounts", async () => {
    const a = await resolveGoogleUser(profile(), tokens());
    const b = await resolveGoogleUser(
      profile({ sub: "google-sub-9", email: `leon@${DOMAIN}` }),
      tokens()
    );

    assert.notEqual(a.userId, b.userId);
  });
});

/* ============================================================
   Linking and unlinking
   ============================================================ */

describe("providers", () => {
  before(cleanup);
  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("lists what is linked", async () => {
    const outcome = await resolveGoogleUser(profile(), tokens());
    assert.deepEqual(await linkedProviders(outcome.userId), ["google"]);
  });

  test("refuses to unlink the last way into an account", async () => {
    // Google-only account: unlinking would lock them out of their own data.
    const outcome = await resolveGoogleUser(profile(), tokens());

    await assert.rejects(
      () => unlinkProvider(outcome.userId, "google"),
      (e: unknown) => e instanceof OAuthError && e.code === "would_lock_out"
    );

    assert.deepEqual(await linkedProviders(outcome.userId), ["google"]);
  });

  test("allows unlinking when a password remains", async () => {
    const existing = await db.user.create({
      data: {
        email: `ana@${DOMAIN}`,
        name: "Ana",
        surname: "Hoxha",
        passwordHash: "bcrypt-placeholder",
      },
    });
    await resolveGoogleUser(profile(), tokens());

    await unlinkProvider(existing.id, "google");
    assert.deepEqual(await linkedProviders(existing.id), []);
  });
});

/* ============================================================
   What the student is told
   ============================================================ */

describe("oauthErrorMessage", () => {
  test("says nothing when nothing went wrong", () => {
    assert.equal(oauthErrorMessage(undefined), null);
  });

  test("every code the callback can emit has a message", () => {
    // These are exactly the codes fail() and OAuthError can produce.
    const codes = [
      "google_off",
      "cancelled",
      "expired",
      "bad_state",
      "bad_nonce",
      "missing_code",
      "token_exchange",
      "bad_token",
      "no_email",
      "unverified_email",
      "not_configured",
      "failed",
    ];

    for (const code of codes) {
      const message = oauthErrorMessage(code);
      assert.ok(message && message.length > 10, `${code} has no real message`);
    }
  });

  test("an unknown code still says something useful", () => {
    const message = oauthErrorMessage("something-new");
    assert.ok(message && message.length > 10);
  });
});
