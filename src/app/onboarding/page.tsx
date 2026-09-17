import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { OnboardingFlow } from "@/components/onboarding/flow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const today = await getToday();
  return <OnboardingFlow firstName={user.name} today={today} />;
}
