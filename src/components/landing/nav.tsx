"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "#si-funksionon", label: "Si funksionon" },
  { href: "#vecorite", label: "Veçoritë" },
  { href: "#mso-bashke", label: "Mso Bashkë" },
  { href: "#ai", label: "AI Asistenti" },
  { href: "#studente", label: "Për studentë" },
];

/** Sticky landing navigation. Shows the app entry point when already signed in. */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-line bg-canvas/85 backdrop-blur-xl"
          : "border-b border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-5 sm:px-8">
        <Wordmark size={30} />

        <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand xl:inline-block">
          AI Study Assistant
        </span>

        <div className="flex-1" />

        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[14px] text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <Link
              href="/sot"
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-brand px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-deep"
            >
              Hap aplikacionin
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="inline-flex h-9 items-center rounded-[9px] px-3.5 text-[14px] font-medium text-ink transition-colors hover:bg-sunken"
              >
                Kyçu
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-brand px-4 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(64,56,206,0.35)] transition-colors hover:bg-brand-deep"
              >
                Regjistrohu
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menyja"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink lg:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="anim-fade border-t border-line bg-canvas px-5 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-[9px] px-3 py-2.5 text-[15px] text-ink transition-colors hover:bg-sunken"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {signedIn ? (
              <Link
                href="/sot"
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-brand text-[15px] font-medium text-white"
              >
                Hap aplikacionin
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="inline-flex h-11 items-center justify-center rounded-[10px] border border-line text-[15px] font-medium text-ink"
                >
                  Kyçu
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-[10px] bg-brand text-[15px] font-medium text-white"
                >
                  Regjistrohu
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
