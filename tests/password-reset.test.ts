import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.ts";
import {
  checkResetToken,
  clearResetTokens,
  consumeResetToken,
  purgeExpiredTokens,
  requestPasswordReset,
} from "@/lib/password-reset.ts";

/**
 * These run against the real database, because the properties worth testing
 * here are about what is actually stored: that the token is not readable, and
 * that a link cannot be spent twice.
 */

const EMAIL = "reset-test@reset.hajdemsojna.test";
const OTHER = "reset-other@reset.hajdemsojna.test";

async function makeUser(email: string, withPassword = true) {
  return db.user.create({
    data: {
      email,
      name: "Test",
      surname: "Student",
      passwordHash: withPassword ? "bcrypt-placeholder" : null,
    },
  });
}

async function cleanup() {
  await db.verificationToken.deleteMany({
    where: { identifier: { contains: "reset.hajdemsojna.test" } },
  });
  await db.user.deleteMany({ where: { email: { endsWith: "reset.hajdemsojna.test" } } });
}

describe("password reset", () => {
  before(cleanup);
  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("issues a token for a real account", async () => {
    await makeUser(EMAIL);
    const request = await requestPasswordReset(EMAIL);

    assert.ok(request, "expected a token");
    assert.ok(request.token.length >= 32);
    assert.ok(request.expires > new Date());
  });

  test("returns null for an address with no account", async () => {
    assert.equal(await requestPasswordReset("nobody@reset.hajdemsojna.test"), null);
  });

  test("returns null for an account with no password to reset", async () => {
    await makeUser(EMAIL, false);
    assert.equal(await requestPasswordReset(EMAIL), null);
  });

  test("is case- and whitespace-insensitive about the address", async () => {
    await makeUser(EMAIL);
    assert.ok(await requestPasswordReset(`  ${EMAIL.toUpperCase()}  `));
  });

  test("stores only a hash, never the token itself", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    const rows = await db.verificationToken.findMany({
      where: { identifier: { contains: EMAIL } },
    });

    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token, request.token, "plaintext token was stored");
    assert.equal(
      rows[0].token,
      createHash("sha256").update(request.token).digest("hex")
    );
  });

  test("issuing a new link invalidates the previous one", async () => {
    await makeUser(EMAIL);
    const first = (await requestPasswordReset(EMAIL))!;
    const second = (await requestPasswordReset(EMAIL))!;

    assert.equal((await checkResetToken(first.token)).ok, false);
    assert.equal((await checkResetToken(second.token)).ok, true);
  });

  test("resolves a valid token to the right user", async () => {
    const user = await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    const outcome = await checkResetToken(request.token);
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.userId, user.id);
  });

  test("rejects a made-up token", async () => {
    const outcome = await checkResetToken("not-a-real-token-at-all");
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "invalid");
  });

  test("rejects an empty token", async () => {
    assert.equal((await checkResetToken("")).ok, false);
  });

  test("reports an expired token as expired, not invalid", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    await db.verificationToken.updateMany({
      where: { identifier: { contains: EMAIL } },
      data: { expires: new Date(Date.now() - 1000) },
    });

    const outcome = await checkResetToken(request.token);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "expired");
  });

  test("checking a token does not spend it", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    assert.equal((await checkResetToken(request.token)).ok, true);
    assert.equal((await checkResetToken(request.token)).ok, true);
  });

  test("a token can be spent exactly once", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    assert.equal((await consumeResetToken(request.token)).ok, true);
    assert.equal(
      (await consumeResetToken(request.token)).ok,
      false,
      "second use should be refused"
    );
  });

  test("two requests racing on one link produce a single winner", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    const results = await Promise.all([
      consumeResetToken(request.token),
      consumeResetToken(request.token),
    ]);

    assert.equal(results.filter((r) => r.ok).length, 1, "exactly one should win");
  });

  test("one student's token is useless against another's account", async () => {
    const mine = await makeUser(EMAIL);
    await makeUser(OTHER);

    const request = (await requestPasswordReset(EMAIL))!;
    const outcome = await checkResetToken(request.token);

    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.userId, mine.id);
  });

  test("clearResetTokens drops outstanding links", async () => {
    await makeUser(EMAIL);
    const request = (await requestPasswordReset(EMAIL))!;

    await clearResetTokens(EMAIL);
    assert.equal((await checkResetToken(request.token)).ok, false);
  });

  test("purgeExpiredTokens removes only expired rows", async () => {
    await makeUser(EMAIL);
    const live = (await requestPasswordReset(EMAIL))!;

    await db.verificationToken.create({
      data: {
        identifier: `password-reset:stale@reset.hajdemsojna.test`,
        token: createHash("sha256").update("stale").digest("hex"),
        expires: new Date(Date.now() - 60_000),
      },
    });

    await purgeExpiredTokens();

    assert.equal((await checkResetToken(live.token)).ok, true, "live token survived");
    const stale = await db.verificationToken.findMany({
      where: { identifier: { contains: "stale@reset.hajdemsojna.test" } },
    });
    assert.equal(stale.length, 0);
  });
});
