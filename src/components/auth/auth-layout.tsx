import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";

/** The split screen shared by sign in and sign up. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* form side */}
      <div className="flex w-full flex-col px-5 py-8 sm:px-10 lg:w-[54%] lg:px-16">
        <div className="flex items-center justify-between">
          <Wordmark size={30} />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            Ballina
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">{title}</h1>
          <p className="mb-7 mt-1.5 text-[14.5px] text-muted">{subtitle}</p>
          {children}
        </div>
      </div>

      {/* brand side */}
      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block lg:w-[46%]">
        <div className="blob absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand/20" />
        <div className="blob absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-mint/20" />

        <div className="relative flex h-full flex-col justify-center px-14">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand">
            <Sparkles size={12} />
            AI Study Assistant
          </span>

          <h2 className="mt-6 text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
            Mëso më zgjuar,
            <br />
            jo më shumë.
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
            Orari, detyrat, provimet dhe progresi yt — të organizuara automatikisht nga AI, sipas
            kohës që ke vërtet.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {[
              "Plan studimi që rregullohet vetë",
              "AI që njeh orarin dhe provimet e tua",
              "Mso Bashkë me shokët e klasës",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint-soft text-mint-deep">
                  <Sparkles size={11} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
