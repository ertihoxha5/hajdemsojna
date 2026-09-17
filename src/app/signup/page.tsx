import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Regjistrohu — Hajde Msojna" };

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Krijo llogarinë tënde"
      subtitle="Falas. Në dy minuta ke planin tënd të parë të studimit."
    >
      <SignUpForm />
    </AuthLayout>
  );
}
