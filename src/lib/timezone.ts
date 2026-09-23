/**
 * The cookie carrying the browser's UTC offset.
 *
 * In its own module because both the server (which reads it) and the client
 * component that writes it need the name, and src/lib/server-date.ts is
 * server-only.
 */
export const TZ_COOKIE = "hm_tz";
