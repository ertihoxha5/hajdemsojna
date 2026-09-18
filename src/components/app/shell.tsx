"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Ellipsis,
  FolderOpen,
  GraduationCap,
  Layers,
  ListTodo,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { longDate } from "@/lib/date";
import { openAssignments } from "@/lib/planner";
import {

  Badge,
  Button,
  IconButton,
  Modal,
  Sheet,
  ToastHost,
  cx,
} from "@/components/ui";
import { Wordmark, LogoMark } from "@/components/brand";
import { UserMenu } from "./user-menu";
import { AIChat } from "./ai-chat";
import { QuickAdd } from "./quick-add";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, today } = useStore();
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openCount = openAssignments(state, today).length;
  const examCount = state.exams.filter((e) => e.date >= today).length;
  const dueCards = state.recall?.due ?? 0;

  const main: NavItem[] = useMemo(
    () => [
      { href: "/sot", label: "Sot", icon: Sun },
      { href: "/orari", label: "Orari", icon: CalendarDays },
      { href: "/plani", label: "Plani", icon: WandSparkles },
      { href: "/lendet", label: "Lëndët", icon: BookOpen },
      { href: "/perserit", label: "Përsëritja", icon: Layers, badge: dueCards },
      { href: "/detyrat", label: "Detyrat", icon: ListTodo, badge: openCount },
      { href: "/provimet", label: "Provimet", icon: GraduationCap, badge: examCount },
      { href: "/mso-bashke", label: "Mso Bashkë", icon: Users },
      { href: "/ai", label: "Asistenti AI", icon: Sparkles },
      { href: "/progresi", label: "Progresi", icon: TrendingUp },
    ],
    [openCount, examCount, dueCards]
  );

  const secondary: NavItem[] = [
    { href: "/notat", label: "Notat", icon: Award },
    { href: "/miqte", label: "Miqtë", icon: UserPlus },
    { href: "/materialet", label: "Materialet", icon: FolderOpen },
  ];

  // ⌘K opens search, ⌘J the assistant — small touches that make it feel like a tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastHost>
      <div className="min-h-screen bg-canvas">
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-line bg-surface lg:flex">
          <div className="px-4 pb-1 pt-5">
            <Wordmark size={30} href="/sot" tagline="Mëso më zgjuar me AI" />
          </div>

          <div className="px-3 pb-2 pt-4">
            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={15} />
              Shto
            </Button>
          </div>

          <nav className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
            <ul className="flex flex-col gap-0.5">
              {main.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </ul>
            <div className="my-3 border-t border-line-soft" />
            <ul className="flex flex-col gap-0.5">
              {secondary.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </ul>
          </nav>

          <div className="border-t border-line p-2">
            <UserMenu />
          </div>
        </aside>

        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="lg:pl-[232px]">
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
              <Link href="/sot" className="flex items-center gap-2 lg:hidden">
                <LogoMark size={26} />
              </Link>

              <div className="hidden text-[13px] text-muted lg:block">{longDate(today)}</div>

              <div className="flex-1" />

              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-faint transition-colors hover:border-brand hover:text-muted sm:flex"
              >
                <Search size={14} />
                Kërko
                <kbd className="ml-4 rounded border border-line bg-canvas px-1 py-px font-mono text-[10.5px]">
                  ⌘K
                </kbd>
              </button>

              <ThemeToggle />
              <NotificationBell />

              <Button
                variant="ai"
                size="sm"
                className="h-8"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Asistenti</span>
              </Button>

              <IconButton
                label="Shto"
                className="bg-brand text-white hover:bg-brand-deep hover:text-white sm:hidden"
                onClick={() => setAddOpen(true)}
              >
                <Plus size={16} />
              </IconButton>

              <div className="lg:hidden">
                <UserMenu compact />
              </div>
            </div>
          </header>

          <main
            className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:pb-16"
          >
            {children}
          </main>
        </div>

        {/* ── Mobile bottom navigation ────────────────────── */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          <div className="grid grid-cols-5">
            <MobileTab href="/sot" label="Sot" icon={Sun} pathname={pathname} />
            <MobileTab href="/orari" label="Orari" icon={CalendarDays} pathname={pathname} />
            <button
              onClick={() => setAiOpen(true)}
              className="flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium text-ai"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ai-soft">
                <Sparkles size={15} />
              </span>
              AI
            </button>
            <MobileTab href="/mso-bashke" label="Grupet" icon={Users} pathname={pathname} />
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium text-muted"
            >
              <Ellipsis size={18} />
              Tjera
            </button>
          </div>
        </nav>

        {/* ── Overlays ────────────────────────────────────── */}
        <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="Asistenti" width={460}>
          <AIChat compact />
        </Sheet>

        <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menyja" side="bottom">
          <div className="grid grid-cols-3 gap-2 p-4">
            {[...main.slice(2), ...secondary, { href: "/cilesimet", label: "Cilësimet", icon: Settings }].map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-4 text-[12.5px] font-medium text-ink"
                >
                  <item.icon size={18} className="text-muted" />
                  {item.label}
                </Link>
              )
            )}
          </div>
        </Sheet>

        <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </ToastHost>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <li>
      <Link
        href={item.href}
        className={cx(
          "group flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
          active ? "bg-brand-soft text-brand" : "text-muted hover:bg-sunken hover:text-ink"
        )}
      >
        <item.icon size={16} className={active ? "text-brand" : "text-faint group-hover:text-muted"} />
        <span className="flex-1">{item.label}</span>
        {!!item.badge && (
          <span className="num rounded-full bg-sunken px-1.5 text-[11px] font-semibold text-muted">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

function MobileTab({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cx(
        "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors",
        active ? "text-brand" : "text-muted"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  return (
    <IconButton label={theme === "dark" ? "Modaliteti i çelët" : "Modaliteti i errët"} onClick={toggleTheme}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}

function NotificationBell() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <>
      <IconButton label="Njoftimet" onClick={() => setOpen(true)} className="relative">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
        )}
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Njoftimet" width={380}>
        <div className="divide-y divide-line">
          {state.notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => dispatch({ type: "notification/read", id: n.id })}
              className="flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-sunken"
            >
              <span
                className={cx(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  n.read ? "bg-transparent" : n.tone === "ai" ? "bg-ai" : n.tone === "warn" ? "bg-warn" : "bg-brand"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{n.title}</span>
                  <span className="shrink-0 text-[11.5px] text-faint">{n.at}</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
                  {n.body}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ============================================================
   Command palette — search across everything the student owns
   ============================================================ */

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");

  function close() {
    setQ("");
    onClose();
  }

  const results = useMemo(() => {
    const term = q.toLowerCase().trim();
    const all: { label: string; sub: string; href: string; icon: React.ElementType }[] = [
      ...state.subjects.map((s) => ({
        label: s.name,
        sub: "Lëndë",
        href: `/lendet/${s.id}`,
        icon: BookOpen,
      })),
      ...state.assignments.map((a) => ({
        label: a.title,
        sub: "Detyrë",
        href: "/detyrat",
        icon: ListTodo,
      })),
      ...state.exams.map((e) => ({
        label: `${state.subjects.find((s) => s.id === e.subjectId)?.name} — ${e.title}`,
        sub: "Provim",
        href: "/provimet",
        icon: GraduationCap,
      })),
      ...state.groups.map((g) => ({
        label: g.name,
        sub: "Grup",
        href: `/mso-bashke/${g.id}`,
        icon: Users,
      })),
      ...state.notes.map((n) => ({
        label: n.title,
        sub: "Shënim",
        href: "/materialet",
        icon: Layers,
      })),
      { label: "Sot", sub: "Faqe", href: "/sot", icon: Sun },
      { label: "Plani i javës", sub: "Faqe", href: "/plani", icon: WandSparkles },
      { label: "Progresi", sub: "Faqe", href: "/progresi", icon: TrendingUp },
      { label: "Notat", sub: "Faqe", href: "/notat", icon: Award },
    ];
    if (!term) return all.slice(0, 8);
    return all.filter((r) => r.label.toLowerCase().includes(term)).slice(0, 10);
  }, [q, state]);

  return (
    <Modal open={open} onClose={close} width={520}>
      <div className="-mx-5 -my-4">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kërko lëndë, detyrë, provim, grup…"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <IconButton label="Mbyll" onClick={close}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-faint">Asgjë nuk u gjet.</p>
          )}
          {results.map((r) => (
            <button
              key={r.href + r.label}
              onClick={() => {
                router.push(r.href);
                close();
              }}
              className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left transition-colors hover:bg-sunken"
            >
              <r.icon size={15} className="text-faint" />
              <span className="flex-1 truncate text-[13.5px] text-ink">{r.label}</span>
              <Badge>{r.sub}</Badge>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
