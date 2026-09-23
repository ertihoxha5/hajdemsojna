import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { TimezoneProbe } from "@/components/timezone-probe";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hajde Msojna — Mëso më zgjuar me AI",
  description:
    "Asistenti yt i studimit me AI: orari, plani personal, detyrat, provimet dhe mësimi në grup — të organizuara automatikisht.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c10" },
  ],
};

/**
 * The theme is resolved here, on the server.
 *
 * This used to be a blocking inline script that read localStorage before
 * first paint, because the server had no way to know the choice. React 19
 * does not execute scripts rendered inside components, and the approach was
 * fragile anyway.
 *
 * Reading a cookie instead means the right colours are in the first byte of
 * HTML — no script, no flash, nothing to hydrate. A visitor who has never
 * chosen gets no `data-theme` at all, and globals.css falls back to the
 * operating system preference in pure CSS, which is equally flash-free.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="sq"
      // Absent rather than guessed when unknown, so the CSS fallback applies.
      {...(theme ? { "data-theme": theme } : {})}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TimezoneProbe />
        {children}
      </body>
    </html>
  );
}
