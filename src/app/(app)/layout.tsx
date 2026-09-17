import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { loadAppState } from "@/server/state";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app/shell";

/**
 * The authenticated shell. The session is checked here on the server — the
 * proxy redirect is only an optimistic first pass — and the student's own data
 * is loaded and handed to the client store, so pages render with real content
 * on the first paint instead of a loading flash.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!user.onboarded) redirect("/onboarding");

  const today = await getToday();
  const state = await loadAppState(user.id, today);

  return (
    <StoreProvider initialState={state} today={today}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
