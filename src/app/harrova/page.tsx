import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Rivendos fjalëkalimin — Hajde Msojna" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Harrove fjalëkalimin?"
      subtitle="Shkruaj email-in e llogarisë dhe të dërgojmë një link për ta rivendosur."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
