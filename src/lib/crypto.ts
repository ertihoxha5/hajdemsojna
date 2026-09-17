import "server-only";
import crypto from "node:crypto";

/**
 * AES-256-GCM for the optional bring-your-own AI key.
 *
 * The plaintext key never leaves the server: it is encrypted on save, decrypted
 * only inside an AI request, and the browser is only ever shown the last four
 * characters. Losing APP_ENCRYPTION_KEY makes stored keys unreadable, which is
 * the intended failure mode — the user re-enters the key.
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY mungon. Gjenero një me: openssl rand -base64 32"
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY duhet të jetë 32 bajt (base64).");
  }
  return buf;
}

/** True when the server is configured to store user-supplied keys at rest. */
export function canStoreSecrets(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export interface Sealed {
  cipher: string;
  iv: string;
  tag: string;
}

export function seal(plaintext: string): Sealed {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, key(), iv);
  const cipher = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return {
    cipher: cipher.toString("base64"),
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  };
}

export function open(sealed: Sealed): string {
  const d = crypto.createDecipheriv(ALGO, key(), Buffer.from(sealed.iv, "base64"));
  d.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(sealed.cipher, "base64")),
    d.final(),
  ]).toString("utf8");
}

/** "sk-ant-…9348" — the only form of a key the browser ever receives. */
export function maskKey(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `${"•".repeat(12)}${tail}`;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
