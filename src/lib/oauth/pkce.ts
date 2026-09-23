import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The one-time values that make an OAuth round trip safe.
 *
 * Three separate things, each closing a different hole:
 *
 *   - **state** ties the callback to the browser that started the flow. Without
 *     it, anyone can hand a victim a callback URL carrying their own code and
 *     silently sign the victim into the attacker's account.
 *   - **PKCE** ties the code to this flow's secret. Google calls us a
 *     confidential client and we do hold a secret, so PKCE is belt and braces
 *     — but a leaked code is worthless without the verifier, and the cost is
 *     one hash.
 *   - **nonce** ties the ID token to this request, so a token minted for some
 *     other session cannot be replayed into ours.
 *
 * All three are generated here and checked on the way back.
 */

export interface FlowSecrets {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

/** URL-safe random, which is what every value here needs to be. */
function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function codeChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createFlowSecrets(): FlowSecrets {
  const codeVerifier = randomUrlSafe(32);
  return {
    state: randomUrlSafe(16),
    nonce: randomUrlSafe(16),
    codeVerifier,
    codeChallenge: codeChallengeFor(codeVerifier),
  };
}

/**
 * Constant-time comparison.
 *
 * State is compared against a value an attacker supplies, so a plain `===`
 * leaks how much of the prefix matched through timing. The difference is
 * tiny and the fix is free.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a leak, so
  // unequal lengths are compared against a same-length buffer and rejected.
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
