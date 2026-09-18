import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic route protection.
 *
 * This only checks whether a session cookie is present — it cannot reach the
 * database, so it is a fast redirect for signed-out visitors, never the
 * security boundary. Real authorisation happens in the data layer: every
 * server query and API route calls requireUser() and scopes by that user id.
 */

const SESSION_COOKIE = "hm_session";

/** Signed-in only. Both the Albanian routes and their English aliases. */
const PROTECTED = [
  "/sot",
  "/orari",
  "/plani",
  "/lendet",
  "/perserit",
  "/detyrat",
  "/provimet",
  "/notat",
  "/progresi",
  "/mso-bashke",
  "/miqte",
  "/materialet",
  "/profili",
  "/cilesimet",
  "/mesim",
  "/ai",
  "/onboarding",
  "/dashboard",
  "/subjects",
  "/assignments",
  "/exams",
  "/groups",
  "/settings",
  "/study",
  "/review",
];

/**
 * Signed-out only — a logged-in user has no reason to see these.
 *
 * /rivendos is deliberately absent: a student who is signed in on one device
 * may still be following a reset link because another device is compromised,
 * and bouncing them to /sot would strip the token from the URL.
 */
const AUTH_ROUTES = ["/signin", "/signup", "/harrova"];

// /konfirmo and /rivendos are intentionally in neither list: both are reached
// from an emailed link, and bouncing either way would strip the token.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !hasSession) {
    const url = new URL("/signin", request.url);
    // Come back to where they were trying to go once signed in.
    if (pathname !== "/sot") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/sot", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets, images and the auth API itself.
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
