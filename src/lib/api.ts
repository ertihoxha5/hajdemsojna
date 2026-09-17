import { NextResponse } from "next/server";
import { UnauthorizedError } from "./session";

/**
 * One place where server errors become responses.
 *
 * Nothing internal reaches the browser: the client gets a short Albanian
 * message and a stable code, while the real error is logged server-side.
 */
export const ERRORS = {
  unauthorized: "Nuk je i kyçur.",
  forbidden: "Nuk ke qasje në këtë burim.",
  notFound: "Nuk u gjet.",
  invalid: "Të dhënat nuk janë të sakta.",
  aiUnavailable: "AI Asistenti për momentin nuk është i disponueshëm. Provo përsëri.",
  aiNotConfigured:
    "AI nuk është konfiguruar. Shto një çelës API te Cilësimet → AI, ose kërko nga administratori.",
  aiInvalidKey: "API key nuk është valide.",
  aiRateLimited: "Ke arritur limitin e përkohshëm të AI. Provo pas pak.",
  aiBadOutput: "AI ktheu një përgjigje të pavlefshme. Provo përsëri.",
  network: "Lidhja dështoi. Kontrollo internetin dhe provo përsëri.",
  server: "Diçka shkoi keq. Provo përsëri.",
} as const;

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Wraps a route handler so thrown errors never leak a stack trace. */
export async function handle<T>(
  fn: () => Promise<T>
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(ERRORS.unauthorized, 401, "unauthorized");
    }
    if (error instanceof AppError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[api]", error);
    return jsonError(ERRORS.server, 500, "server");
  }
}

export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}
