import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { checkResetToken } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Fjalëkalim i ri — Hajde Msojna" };

/**
 * The token is checked before the form is rendered, so a student with a stale
 * link is told immediately rather than after typing a new password twice. The
 * check does not spend the token — resetPasswordAction does that.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = await checkResetToken(token ?? "");

  if (!outcome.ok) {
    const expired = outcome.reason === "expired";
    return (
      <AuthLayout
        title={expired ? "Linku ka skaduar" : "Link i pavlefshëm"}
        subtitle={
          expired
            ? "Linkat e rivendosjes vlejnë një orë. Kërko një të ri dhe provo përsëri."
            : "Ky link nuk është valid ose është përdorur tashmë."
        }
      >
        <Link
          href="/harrova"
          className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-brand text-[15px] font-medium text-white transition-colors hover:bg-brand-deep"
        >
          Kërko një link të ri
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Zgjidh një fjalëkalim të ri"
      subtitle="Të paktën 8 karaktere, me shkronja dhe numra."
    >
      <ResetPasswordForm token={token!} />
    </AuthLayout>
  );
}
