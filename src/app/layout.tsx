import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
 * Runs before first paint: applies the saved theme so dark mode never flashes,
 * and records the browser's UTC offset so the server can render dates in the
 * student's own timezone rather than its own.
 */
const bootScript = `(function(){try{
var t=localStorage.getItem("hm-theme");
if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
document.documentElement.dataset.theme=t;
var o=new Date().getTimezoneOffset();
if(document.cookie.indexOf("hm_tz="+o)===-1){
document.cookie="hm_tz="+o+";path=/;max-age=31536000;samesite=lax";}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="sq"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
