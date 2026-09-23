/**
 * The name of the cookie carrying the one-time flow secrets.
 *
 * It lives here rather than in the route that sets it because Next validates
 * what a route module exports, and a stray constant is not one of the things
 * it allows.
 */
export const FLOW_COOKIE = "hm_oauth";

/** How long a half-finished sign-in stays valid. */
export const FLOW_TTL_SECONDS = 600;
