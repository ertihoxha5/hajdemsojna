import "server-only";
import crypto from "node:crypto";

/** Stable ids for rows the server creates (AI plans, group messages). */
export function newServerId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(8).toString("hex")}`;
}
