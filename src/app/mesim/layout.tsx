import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getToday } from "@/lib/server-date";
import { loadAppState } from "@/server/state";
import { StoreProvider } from "@/lib/store";

/** Focus mode runs outside the app shell but on the same authenticated store. */
export default async function StudyLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const today = await getToday();
  const state = await loadAppState(user.id, today);

  return (
    <StoreProvider initialState={state} today={today}>
      {children}
    </StoreProvider>
  );
}
