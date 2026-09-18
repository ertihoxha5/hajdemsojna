import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.ts";
import { confirmEmail, requestEmailVerification } from "@/lib/email-verify.ts";
import { requestPasswordReset, checkResetToken } from "@/lib/password-reset.ts";

/**
 * Both flows share one table, so the property that matters most is that they
 * cannot accept each other's tokens: a confirmation link must never be usable
 * to seize an account.
 */

const DOMAIN = "verify.hajdemsojna.test";
const EMAIL = `me@${DOMAIN}`;

async function makeUser(email = EMAIL, verified = false) {
  return db.user.create({
    data: {
      email,
      name: "Test",
      surname: "Student",
      passwordHash: "bcrypt-placeholder",
      emailVerified: verified ? new Date() : null,
    },
  });
}

async function cleanup() {
  await db.verificationToken.deleteMany({
    where: { identifier: { contains: DOMAIN } },
  });
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

describe("email verification", () => {
  before(cleanup);
  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("issues a token for an unconfirmed address", async () => {
    await makeUser();
    const request = await requestEmailVerification(EMAIL);

    assert.ok(request);
    assert.ok(request.token.length >= 32);
  });

  test("returns null when the address is already confirmed", async () => {
    await makeUser(EMAIL, true);
    assert.equal(await requestEmailVerification(EMAIL), null);
  });

  test("returns null for an address with no account", async () => {
    assert.equal(await requestEmailVerification(`nobody@${DOMAIN}`), null);
  });

  test("stores only a hash of the token", async () => {
    await makeUser();
    const request = (await requestEmailVerification(EMAIL))!;

    const rows = await db.verificationToken.findMany({
      where: { identifier: { contains: EMAIL } },
    });

    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token, request.token);
    assert.equal(
      rows[0].token,
      createHash("sha256").update(request.token).digest("hex")
    );
  });

  test("confirming marks the user verified", async () => {
    const user = await makeUser();
    const request = (await requestEmailVerification(EMAIL))!;

    const outcome = await confirmEmail(request.token);
    assert.equal(outcome.ok, true);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(after.emailVerified, "emailVerified was not set");
  });

  test("a token can be spent only once", async () => {
    await makeUser();
    const request = (await requestEmailVerification(EMAIL))!;

    assert.equal((await confirmEmail(request.token)).ok, true);
    assert.equal((await confirmEmail(request.token)).ok, false);
  });

  test("rejects a made-up or empty token", async () => {
    assert.equal((await confirmEmail("")).ok, false);
    assert.equal((await confirmEmail("not-a-real-token")).ok, false);
  });

  test("reports an expired token as expired", async () => {
    await makeUser();
    const request = (await requestEmailVerification(EMAIL))!;

    await db.verificationToken.updateMany({
      where: { identifier: { contains: EMAIL } },
      data: { expires: new Date(Date.now() - 1000) },
    });

    const outcome = await confirmEmail(request.token);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "expired");
  });

  test("a verification token cannot be used to reset a password", async () => {
    await makeUser();
    const request = (await requestEmailVerification(EMAIL))!;

    const outcome = await checkResetToken(request.token);
    assert.equal(outcome.ok, false, "scope prefix did not keep the flows apart");
  });

  test("a reset token cannot be used to confirm an address", async () => {
    await makeUser();
    const request = (await requestPasswordReset(EMAIL))!;

    const outcome = await confirmEmail(request.token);
    assert.equal(outcome.ok, false, "scope prefix did not keep the flows apart");
  });

  test("the two flows can be outstanding at the same time", async () => {
    await makeUser();
    const verify = (await requestEmailVerification(EMAIL))!;
    const reset = (await requestPasswordReset(EMAIL))!;

    assert.equal((await checkResetToken(reset.token)).ok, true);
    assert.equal((await confirmEmail(verify.token)).ok, true);
  });
});
