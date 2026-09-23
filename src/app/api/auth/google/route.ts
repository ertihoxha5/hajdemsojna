import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthUrl, googleConfigured } from "@/lib/oauth/google";
import { createFlowSecrets } from "@/lib/oauth/pkce";
import { FLOW_COOKIE, FLOW_TTL_SECONDS } from "@/lib/oauth/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts the Google flow.
 *
 * The state, nonce and PKCE verifier are minted here and stored in an
 * httpOnly cookie — never in the URL, and never in a store the browser can
 * read. The callback refuses anything that does not match them.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/signin?error=google_off", request.url)
    );
  }

  const secrets = createFlowSecrets();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "";

  const jar = await cookies();
  jar.set(
    FLOW_COOKIE,
    JSON.stringify({
      state: secrets.state,
      nonce: secrets.nonce,
      verifier: secrets.codeVerifier,
      // Only same-site paths are ever honoured, so this cannot be turned
      // into an open redirect.
      next: next.startsWith("/") && !next.startsWith("//") ? next : "",
    }),
    {
      httpOnly: true,
      // Lax rather than Strict: the browser arrives back here from Google's
      // domain, and Strict would drop the cookie on exactly that navigation.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: FLOW_TTL_SECONDS,
    }
  );

  return NextResponse.redirect(
    buildAuthUrl({
      state: secrets.state,
      nonce: secrets.nonce,
      codeChallenge: secrets.codeChallenge,
    })
  );
}
