/**
 * Client-generated ids.
 *
 * The browser creates the id so an optimistic row and the row the server
 * writes are the same record — no reconciliation step, and a follow-up edit
 * made before the write lands still addresses the right row.
 */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
