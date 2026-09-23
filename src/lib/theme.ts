/**
 * The chosen theme, stored where the server can read it.
 *
 * It used to live in localStorage, which the server cannot see — so the root
 * layout carried a blocking inline script to apply the theme before first
 * paint and avoid a flash of the wrong one. React 19 refuses to run scripts
 * rendered inside components, and it was always a fragile way to do this.
 *
 * A cookie is simply better: the server already knows the theme when it
 * renders `<html>`, so the correct colours are in the very first byte of
 * HTML. No script, no flash, and nothing to hydrate.
 *
 * Someone who has never chosen gets no attribute at all, and the stylesheet
 * falls back to the operating system's own preference — which is pure CSS
 * and therefore also flash-free.
 */

export const THEME_COOKIE = "hm-theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Reads the theme from a raw cookie value. Null means "not chosen". */
export function parseTheme(raw: string | undefined | null): Theme | null {
  return isTheme(raw) ? raw : null;
}

/**
 * Persists the choice so the next server render already knows it.
 *
 * Not httpOnly: the client toggles the theme and must be able to write it.
 * There is nothing sensitive in the word "dark".
 */
export function writeThemeCookie(theme: Theme): void {
  try {
    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_MAX_AGE};samesite=lax`;
  } catch {
    // Blocked cookies: the theme still applies for this session.
  }
}

/** The theme in effect right now, for a client that has not been told. */
export function detectTheme(): Theme {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hm-theme=(light|dark)/);
    if (match) return match[1] as Theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
