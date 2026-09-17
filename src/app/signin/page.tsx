import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Kyçu — Hajde Msojna" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthLayout title="Mirë se u ktheve" subtitle="Kyçu për të vazhduar planin tënd të studimit.">
      <SignInForm next={next} />
    </AuthLayout>
  );
}
