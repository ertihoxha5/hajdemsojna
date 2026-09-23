import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  OAuthError,
  exchangeCode,
  googleConfigured,
  verifyIdToken,
} from "@/lib/oauth/google";
import { safeEqual } from "@/lib/oauth/pkce";
import { createSession } from "@/lib/session";
import { resolveGoogleUser } from "@/server/oauth";
import { FLOW_COOKIE } from "@/lib/oauth/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Where Google sends the browser back.
 *
 * Every failure ends at /signin with a short reason rather than a stack
 * trace: this page is reachable by anyone with a link, so it must never
 * describe what went wrong internally.
 */

interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
}

function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.state === "string" &&
      typeof parsed?.nonce === "string" &&
      typeof parsed?.verifier === "string"
    ) {
      return {
        state: parsed.state,
        nonce: parsed.nonce,
        verifier: parsed.verifier,
        next: typeof parsed.next === "string" ? parsed.next : "",
      };
    }
  } catch {
    // A malformed cookie is treated as no cookie.
  }
  return null;
}

/**
 * Ends the flow at the sign-in page with a short reason.
 *
 * The cookie is cleared through the same `cookies()` store that
 * createSession writes to, rather than on the response object — mixing the
 * two would leave it ambiguous which set of mutations reaches the browser.
 */
async function fail(request: Request, reason: string) {
  (await cookies()).delete(FLOW_COOKIE);
  return NextResponse.redirect(new URL(`/signin?error=${reason}`, request.url));
}

export async function GET(request: Request) {
  if (!googleConfigured()) return await fail(request, "google_off");

  const url = new URL(request.url);

  // The user pressed cancel on Google's screen. Not an error worth shouting
  // about — send them back to sign in.
  const denied = url.searchParams.get("error");
  if (denied) return await fail(request, "cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return await fail(request, "missing_code");

  const jar = await cookies();
  const flow = readFlow(jar.get(FLOW_COOKIE)?.value);

  // No cookie means this callback did not start here: either it expired, or
  // somebody sent the link to someone else.
  if (!flow) return await fail(request, "expired");
  if (!safeEqual(flow.state, state)) return await fail(request, "bad_state");

  try {
    const tokens = await exchangeCode(code, flow.verifier);
    const profile = await verifyIdToken(tokens.idToken, flow.nonce);
    const outcome = await resolveGoogleUser(profile, tokens);

    const agent = (await headers()).get("user-agent") ?? undefined;
    await createSession(outcome.userId, agent);

    // Somewhere sensible: where they were headed, then the app, then
    // onboarding for an account that has just been created.
    const target =
      flow.next || (outcome.onboarded ? "/sot" : "/onboarding");

    // Spent, so it goes. The session cookie createSession just wrote travels
    // out on the same response.
    jar.delete(FLOW_COOKIE);

    return NextResponse.redirect(new URL(target, request.url));
  } catch (error) {
    if (error instanceof OAuthError) {
      return await fail(request, error.code);
    }
    console.error("[google/callback]", error);
    return await fail(request, "failed");
  }
}
