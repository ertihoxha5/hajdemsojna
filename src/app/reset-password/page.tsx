import { redirect } from "next/navigation";

/** English alias for the Albanian route the app actually uses. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(token ? `/rivendos?token=${encodeURIComponent(token)}` : "/rivendos");
}
