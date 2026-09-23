"use client";

import { useEffect } from "react";
import { TZ_COOKIE } from "@/lib/timezone";

/**
 * Tells the server which timezone the student is actually in.
 *
 * The server cannot know a browser's UTC offset, and a scheduling app has to
 * agree with the clock on the student's wall rather than the one in the data
 * centre. So the browser writes it into a cookie and `getToday()` reads it.
 *
 * This runs after hydration rather than in a blocking script, which is fine:
 * the offset only affects which day server-rendered dates fall on, and the
 * very first request simply falls back to server local time. A wrong day for
 * one render is worth far less than a render-blocking script on every load.
 */
export function TimezoneProbe() {
  useEffect(() => {
    try {
      const offset = new Date().getTimezoneOffset();
      if (document.cookie.includes(`${TZ_COOKIE}=${offset}`)) return;

      document.cookie = `${TZ_COOKIE}=${offset};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // Blocked cookies: server local time remains the fallback.
    }
  }, []);

  return null;
}
