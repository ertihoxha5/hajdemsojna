import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { RoomClient } from "./room-client";

/**
 * Membership is checked on the server before anything renders, so a space id
 * guessed from a URL never produces a half-drawn room the client then has to
 * take away again.
 */
export default async function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=/mso-bashke/${id}`);

  const member = await db.studySpaceMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
    select: { id: true },
  });

  if (!member) {
    const space = await db.studySpace.findUnique({
      where: { id },
      select: { privacy: true },
    });
    if (!space) notFound();
    // A room that exists but is not yours: offer the join path rather than
    // a dead end.
    redirect(`/mso-bashke/hyr?space=${id}`);
  }

  return <RoomClient spaceId={id} />;
}
