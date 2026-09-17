"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { signInAction, signUpAction, type AuthResult } from "@/server/auth-actions";
import { cx } from "@/components/ui";

/* ============================================================
   Shared pieces
   ============================================================ */

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-[15px] font-medium text-white transition-all hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Duke vazhduar…
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={16} />
        </>
      )}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  error,
  autoComplete,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  defaultValue?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={!!error}
          className={cx(
            "h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[14.5px] text-ink outline-none transition-colors placeholder:text-faint",
            error ? "border-bad focus:border-bad" : "border-line focus:border-brand"
          )}
        />
        {children}
      </div>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-bad">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
    </label>
  );
}

function PasswordField(props: Parameters<typeof Field>[0] & { value?: string; onChange?: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{props.label}</span>
        <div className="relative">
          <input
            name={props.name}
            type={show ? "text" : "password"}
            placeholder={props.placeholder}
            autoComplete={props.autoComplete}
            value={props.value}
            onChange={(e) => props.onChange?.(e.target.value)}
            aria-invalid={!!props.error}
            className={cx(
              "h-11 w-full rounded-[10px] border bg-surface px-3.5 pr-11 text-[14.5px] text-ink outline-none transition-colors placeholder:text-faint",
              props.error ? "border-bad focus:border-bad" : "border-line focus:border-brand"
            )}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Fshihe fjalëkalimin" : "Shfaq fjalëkalimin"}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition-colors hover:text-muted"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      {props.error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-bad">
          <AlertCircle size={12} />
          {props.error}
        </span>
      )}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="anim-pop flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-bad" />
      <p className="text-[13px] leading-relaxed text-bad">{message}</p>
    </div>
  );
}

/* ============================================================
   Sign in
   ============================================================ */

export function SignInForm({ next }: { next?: string }) {
  const [result, action] = useActionState<AuthResult | null, FormData>(
    signInAction,
    null
  );
  const errors = result?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors.form} />
      {next && <input type="hidden" name="next" value={next} />}

      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="studenti@shembull.com"
        autoComplete="email"
        error={errors.email}
      />
      <PasswordField
        label="Fjalëkalimi"
        name="password"
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password}
      />

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="h-4 w-4 rounded border-line accent-[var(--brand)]"
          />
          Më mbaj të kyçur
        </label>
        <Link href="/signin" className="text-[13px] text-brand hover:underline">
          Keni harruar fjalëkalimin?
        </Link>
      </div>

      <SubmitButton>Kyçu</SubmitButton>

      <p className="text-center text-[13.5px] text-muted">
        Nuk ke llogari?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Regjistrohu
        </Link>
      </p>
    </form>
  );
}

/* ============================================================
   Sign up
   ============================================================ */

const RULES = [
  { label: "Të paktën 8 karaktere", test: (v: string) => v.length >= 8 },
  { label: "Një shkronjë", test: (v: string) => /[a-zA-Z]/.test(v) },
  { label: "Një numër", test: (v: string) => /[0-9]/.test(v) },
];

export function SignUpForm() {
  const [result, action] = useActionState<AuthResult | null, FormData>(
    signUpAction,
    null
  );
  const [password, setPassword] = useState("");
  const errors = result?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors.form} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Emri" name="name" placeholder="Arben" autoComplete="given-name" error={errors.name} />
        <Field
          label="Mbiemri"
          name="surname"
          placeholder="Deda"
          autoComplete="family-name"
          error={errors.surname}
        />
      </div>

      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="arben@shembull.com"
        autoComplete="email"
        error={errors.email}
      />

      <div>
        <PasswordField
          label="Fjalëkalimi"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.password}
          value={password}
          onChange={setPassword}
        />
        {password.length > 0 && (
          <div className="anim-fade mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <span
                  key={r.label}
                  className={cx(
                    "flex items-center gap-1.5 text-[12px]",
                    ok ? "text-ok" : "text-faint"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                      ok ? "border-ok bg-ok text-white" : "border-line"
                    )}
                  >
                    {ok && <Check size={9} />}
                  </span>
                  {r.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <PasswordField
        label="Konfirmo fjalëkalimin"
        name="confirm"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.confirm}
      />

      <SubmitButton>Krijo llogarinë</SubmitButton>

      <p className="text-center text-[12.5px] leading-relaxed text-faint">
        Duke u regjistruar, i pranon Kushtet e Përdorimit dhe Politikën e Privatësisë.
      </p>

      <p className="text-center text-[13.5px] text-muted">
        Ke tashmë llogari?{" "}
        <Link href="/signin" className="font-medium text-brand hover:underline">
          Kyçu
        </Link>
      </p>
    </form>
  );
}
