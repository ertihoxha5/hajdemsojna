"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Moon, Settings, Sparkles, Sun, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { signOutAction } from "@/server/auth-actions";
import { Avatar, cx } from "@/components/ui";

/**
 * Avatar menu: profile, settings, theme, and sign out.
 *
 * Signing out is a server action, so the session row is deleted and the cookie
 * cleared on the server — not just hidden in the browser.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { state, theme, toggleTheme } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = `${state.profile.name[0] ?? ""}${state.profile.surname[0] ?? ""}`.toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          "flex items-center gap-2 rounded-[9px] transition-colors",
          compact ? "p-0.5 hover:bg-sunken" : "w-full px-2.5 py-2 hover:bg-sunken",
          open && "bg-sunken"
        )}
      >
        <Avatar initials={initials} toneIndex={state.profile.avatarTone} size={28} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink">
                {state.profile.name} {state.profile.surname}
              </span>
              <span className="block truncate text-[11px] text-faint">
                {state.profile.year || state.profile.institution || "Student"}
              </span>
            </span>
            <ChevronDown size={14} className="shrink-0 text-faint" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            "anim-pop absolute z-50 w-56 overflow-hidden rounded-[12px] border border-line bg-raised shadow-[var(--shadow-lg)]",
            compact ? "right-0 top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)] left-0"
          )}
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-[13px] font-medium text-ink">
              {state.profile.name} {state.profile.surname}
            </p>
            <p className="truncate text-[11.5px] text-faint">
              {state.profile.institution || "Hajde Msojna"}
            </p>
          </div>

          <div className="p-1.5">
            <MenuLink href="/profili" icon={User} label="Profili" onClick={() => setOpen(false)} />
            <MenuLink
              href="/cilesimet"
              icon={Settings}
              label="Cilësimet"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/cilesimet/ai"
              icon={Sparkles}
              label="Cilësimet e AI"
              onClick={() => setOpen(false)}
            />

            <button
              onClick={toggleTheme}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-sunken"
            >
              {theme === "dark" ? <Sun size={15} className="text-faint" /> : <Moon size={15} className="text-faint" />}
              {theme === "dark" ? "Modaliteti i çelët" : "Modaliteti i errët"}
            </button>
          </div>

          <form action={signOutAction} className="border-t border-line p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-bad transition-colors hover:bg-bad-soft"
            >
              <LogOut size={15} />
              Dil
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] text-ink transition-colors hover:bg-sunken"
    >
      <Icon size={15} className="text-faint" />
      {label}
    </Link>
  );
}
