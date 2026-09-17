import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email-i nuk është valid"),
});
const respondSchema = z.object({
  friendshipId: z.string().min(1),
  accept: z.boolean(),
});

/** Accepted friends plus any pending requests in either direction. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const rows = await db.friendship.findMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { include: { profile: true, subjects: true } },
        addressee: { include: { profile: true, subjects: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const mySubjects = new Set(
      (await db.subject.findMany({ where: { userId: user.id }, select: { name: true } })).map((s) =>
        s.name.toLowerCase()
      )
    );

    const shape = (row: (typeof rows)[number]) => {
      const other = row.requesterId === user.id ? row.addressee : row.requester;
      return {
        friendshipId: row.id,
        id: other.id,
        name: `${other.name} ${other.surname}`.trim(),
        initials: `${other.name[0] ?? "?"}${other.surname[0] ?? ""}`.toUpperCase(),
        tone: other.profile?.avatarTone ?? 0,
        faculty: other.profile?.institution ?? "",
        mutualSubjects: other.subjects
          .filter((s) => mySubjects.has(s.name.toLowerCase()))
          .map((s) => s.name),
        streak: other.profile?.streak ?? 0,
        incoming: row.addresseeId === user.id,
      };
    };

    return NextResponse.json({
      friends: rows.filter((r) => r.status === "accepted").map(shape),
      pending: rows.filter((r) => r.status === "pending").map(shape),
    });
  });
}

/** Sends a friend request by email. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? ERRORS.invalid, 400, "invalid_input");
    }

    if (parsed.data.email === user.email) {
      return jsonError("Nuk mund ta shtosh veten.", 400, "self");
    }

    const other = await db.user.findUnique({ where: { email: parsed.data.email } });
    // Deliberately the same answer whether or not the address exists, so this
    // can't be used to discover who has an account.
    if (!other) {
      return NextResponse.json({ ok: true, sent: true });
    }

    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: other.id },
          { requesterId: other.id, addresseeId: user.id },
        ],
      },
    });

    if (!existing) {
      await db.friendship.create({
        data: { requesterId: user.id, addresseeId: other.id, status: "pending" },
      });
      await db.notification.create({
        data: {
          userId: other.id,
          title: "Kërkesë e re miqësie",
          body: `${user.name} ${user.surname} dëshiron të lidhet me ty.`,
          tone: "info",
        },
      });
    }

    return NextResponse.json({ ok: true, sent: true });
  });
}

/** Accepts or declines a request addressed to this user. */
export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = respondSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const row = await db.friendship.findFirst({
      where: { id: parsed.data.friendshipId, addresseeId: user.id, status: "pending" },
    });
    if (!row) return jsonError(ERRORS.notFound, 404, "not_found");

    if (parsed.data.accept) {
      await db.friendship.update({ where: { id: row.id }, data: { status: "accepted" } });
      await db.notification.create({
        data: {
          userId: row.requesterId,
          title: "Kërkesa u pranua",
          body: `${user.name} e pranoi kërkesën tënde.`,
          tone: "ok",
        },
      });
    } else {
      await db.friendship.delete({ where: { id: row.id } });
    }

    return NextResponse.json({ ok: true });
  });
}

/** Removes an existing friendship. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(ERRORS.invalid, 400, "invalid_input");

    await db.friendship.deleteMany({
      where: {
        id,
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
    });

    return NextResponse.json({ ok: true });
  });
}
