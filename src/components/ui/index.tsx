"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { tone } from "@/lib/tone";
import { useStore } from "@/lib/store";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ============================================================
   Surfaces
   ============================================================ */

export function Card({
  children,
  className,
  as: As = "div",
  padded = true,
  hover = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
  padded?: boolean;
  hover?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cx(
        "rounded-[14px] border border-line bg-surface",
        padded && "p-5",
        hover && "transition-[box-shadow,transform,border-color] hover:border-line hover:shadow-[var(--shadow-md)]",
        className
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function SectionTitle({
  children,
  action,
  sub,
}: {
  children: ReactNode;
  action?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{children}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  question,
  right,
}: {
  title: ReactNode;
  question?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[30px]">
          {title}
        </h1>
        {question && <p className="mt-1.5 text-[14px] text-muted">{question}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

/* ============================================================
   Buttons
   ============================================================ */

type BtnVariant = "primary" | "secondary" | "ghost" | "ai" | "danger" | "subtle";
type BtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex select-none items-center justify-center gap-1.5 rounded-[9px] font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_1px_2px_rgba(64,56,206,0.35)] hover:bg-brand-deep",
  secondary:
    "border border-line bg-surface text-ink hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  subtle: "bg-sunken text-ink hover:bg-line-soft",
  ai: "bg-ai-soft text-ai hover:brightness-[0.97]",
  danger: "bg-bad-soft text-bad hover:brightness-[0.97]",
};

const BTN_SIZE: Record<BtnSize, string> = {
  sm: "h-7 px-2.5 text-[12.5px]",
  md: "h-9 px-3.5 text-[13.5px]",
  lg: "h-11 px-5 text-[15px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: BtnSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Badges & indicators
   ============================================================ */

export function Badge({
  children,
  tone: t = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "ai" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const map = {
    neutral: "bg-sunken text-muted",
    brand: "bg-brand-soft text-brand",
    ai: "bg-ai-soft text-ai",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium",
        map[t],
        className
      )}
    >
      {children}
    </span>
  );
}

/** A subject's colour chip — the app's main way of identifying a course. */
export function SubjectDot({ toneIndex, size = 8 }: { toneIndex: number; size?: number }) {
  const { theme } = useStore();
  const c = tone(toneIndex, theme === "dark");
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: c.fg }}
    />
  );
}

export function useTone(toneIndex: number) {
  const { theme } = useStore();
  return tone(toneIndex, theme === "dark");
}

export function Progress({
  value,
  className,
  height = 6,
  color,
}: {
  value: number;
  className?: string;
  height?: number;
  color?: string;
}) {
  return (
    <div
      className={cx("w-full overflow-hidden rounded-full bg-sunken", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color ?? "var(--brand)",
        }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 6,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? "var(--brand)"}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone: t,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "ok" | "warn" | "bad";
}) {
  const color = t === "ok" ? "text-ok" : t === "warn" ? "text-warn" : t === "bad" ? "text-bad" : "text-ink";
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-faint">{label}</div>
      <div className={cx("num mt-1 text-[22px] font-semibold leading-none", color)}>{value}</div>
      {sub && <div className="mt-1.5 text-[12.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function Avatar({
  initials,
  toneIndex = 0,
  size = 32,
  ring,
}: {
  initials: string;
  toneIndex?: number;
  size?: number;
  ring?: string;
}) {
  const c = useTone(toneIndex);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: size * 0.36,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {initials}
    </span>
  );
}

/* ============================================================
   Tabs
   ============================================================ */

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("no-scrollbar -mb-px flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cx(
              "relative shrink-0 px-3 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors",
              on ? "text-ink" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="num ml-1.5 text-[11.5px] text-faint">{t.count}</span>
            )}
            {on && (
              <span className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-ink" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-[9px] border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cx(
            "rounded-[7px] font-medium transition-all",
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
            o.key === value
              ? "bg-sunken text-ink"
              : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   Modal / Sheet
   ============================================================ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // The whole app renders client-side (see StoreProvider), so `document` is
  // always available here — no mount flag needed to portal safely.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="anim-fade absolute inset-0 bg-[rgba(12,12,16,0.44)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-pop relative max-h-[90vh] w-full overflow-y-auto rounded-t-[18px] border border-line bg-surface shadow-[var(--shadow-lg)] sm:rounded-[16px]"
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3.5">
            <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
            <IconButton label="Mbyll" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "right",
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: "right" | "bottom";
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="anim-fade absolute inset-0 bg-[rgba(12,12,16,0.4)]" onClick={onClose} />
      <div
        className={cx(
          "absolute flex flex-col border-line bg-surface shadow-[var(--shadow-lg)]",
          side === "right"
            ? "anim-pop inset-y-0 right-0 w-full border-l sm:w-[var(--w)]"
            : "anim-pop inset-x-0 bottom-0 max-h-[85vh] rounded-t-[18px] border-t"
        )}
        style={{ ["--w" as string]: `${width}px` }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <IconButton label="Mbyll" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ============================================================
   Form fields
   ============================================================ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

const INPUT =
  "w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(INPUT, "resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(INPUT, "cursor-pointer", props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <label htmlFor={id} className="block text-[14px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand" : "bg-line"
        )}
      >
        <span
          className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: `translateX(${checked ? 19 : 3}px)` }}
        />
      </button>
    </div>
  );
}

/* ============================================================
   Misc
   ============================================================ */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-[14.5px] font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Three-dot "AI is thinking" indicator. */
export function Thinking({ label = "Po mendoj" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-ai"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const idRef = useRef(0);

  const push = (msg: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-pop pointer-events-auto max-w-[90vw] rounded-[10px] border border-line bg-raised px-3.5 py-2 text-[13px] text-ink shadow-[var(--shadow-lg)]"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
