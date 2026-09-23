import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/auth-forms";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { oauthErrorMessage } from "@/lib/oauth/messages";
import { googleConfigured } from "@/lib/oauth/google";

export const metadata: Metadata = { title: "Kyçu — Hajde Msojna" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Asked on the server, so the button never appears in an installation
  // where it could not possibly work.
  const withGoogle = googleConfigured();
  const message = oauthErrorMessage(error);

  return (
    <AuthLayout title="Mirë se u ktheve" subtitle="Kyçu për të vazhduar planin tënd të studimit.">
      <div className="flex flex-col gap-4">
        {message && (
          <div className="flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3.5 py-2.5">
            <p className="text-[13px] leading-relaxed text-bad">{message}</p>
          </div>
        )}

        {withGoogle && (
          <>
            <GoogleButton next={next} label="Kyçu me Google" />
            <AuthDivider />
          </>
        )}

        <SignInForm next={next} />
      </div>
    </AuthLayout>
  );
}
