import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { confirmEmail } from "@/lib/email-verify";

export const metadata: Metadata = { title: "Konfirmo email-in — Hajde Msojna" };

/**
 * Spends the confirmation token.
 *
 * Doing this in the page rather than behind a button is the right trade here:
 * the link is single-use and arrives by email, so the click itself is the
 * confirmation. There is nothing destructive to guard against.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = await confirmEmail(token ?? "");

  if (outcome.ok) {
    return (
      <AuthLayout
        title="Email-i u konfirmua"
        subtitle="Faleminderit. Tani do të marrësh njoftimet për afate dhe provime."
      >
        <Link
          href="/sot"
          className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-brand text-[15px] font-medium text-white transition-colors hover:bg-brand-deep"
        >
          Vazhdo te Sot
        </Link>
      </AuthLayout>
    );
  }

  const expired = outcome.reason === "expired";

  return (
    <AuthLayout
      title={expired ? "Linku ka skaduar" : "Link i pavlefshëm"}
      subtitle={
        expired
          ? "Linkat e konfirmimit vlejnë dy ditë. Kërko një të ri nga Cilësimet."
          : "Ky link nuk është valid, ose adresa është konfirmuar tashmë."
      }
    >
      <Link
        href="/sot"
        className="inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-line text-[15px] font-medium text-ink transition-colors hover:border-brand"
      >
        Kthehu te aplikacioni
      </Link>
    </AuthLayout>
  );
}
