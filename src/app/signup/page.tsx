import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { oauthErrorMessage } from "@/lib/oauth/messages";
import { googleConfigured } from "@/lib/oauth/google";

export const metadata: Metadata = { title: "Regjistrohu — Hajde Msojna" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const withGoogle = googleConfigured();
  const message = oauthErrorMessage(error);

  return (
    <AuthLayout
      title="Krijo llogarinë tënde"
      subtitle="Falas. Në dy minuta ke planin tënd të parë të studimit."
    >
      <div className="flex flex-col gap-4">
        {message && (
          <div className="flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5">
            <p className="text-[13px] leading-relaxed text-bad">{message}</p>
          </div>
        )}

        {withGoogle && (
          <>
            <GoogleButton label="Regjistrohu me Google" />
            <AuthDivider />
          </>
        )}

        <SignUpForm />
      </div>
    </AuthLayout>
  );
}
