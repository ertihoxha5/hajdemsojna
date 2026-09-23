import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { THEME_COOKIE, isTheme, parseTheme } from "@/lib/theme.ts";
import { TZ_COOKIE } from "@/lib/timezone.ts";

/**
 * The theme moved from localStorage to a cookie so the server can render it
 * directly, which removed the blocking inline script from the root layout.
 * These pin the parsing, because a bad value must fall back rather than end
 * up as a stray attribute on <html>.
 */

describe("parseTheme", () => {
  test("accepts the two real themes", () => {
    assert.equal(parseTheme("light"), "light");
    assert.equal(parseTheme("dark"), "dark");
  });

  test("returns null for anything else, so the CSS fallback applies", () => {
    for (const bad of [undefined, null, "", "Dark", "system", "<script>", "1"]) {
      assert.equal(parseTheme(bad), null, `accepted ${JSON.stringify(bad)}`);
    }
  });

  test("isTheme agrees with parseTheme", () => {
    assert.equal(isTheme("dark"), true);
    assert.equal(isTheme("purple"), false);
  });
});

describe("cookie names", () => {
  test("are the ones the rest of the app reads", () => {
    // Changing either silently would break server-rendered dates or the
    // theme, and neither failure is loud.
    assert.equal(THEME_COOKIE, "hm-theme");
    assert.equal(TZ_COOKIE, "hm_tz");
  });
});
