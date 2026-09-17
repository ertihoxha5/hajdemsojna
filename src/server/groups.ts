import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api";

/** Short, unambiguous invite code (no 0/O/1/I). */
export function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Membership check used by every group endpoint before anything else. */
export async function requireMembership(groupId: string, userId: string) {
  const member = await db.studyGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: { include: { subject: true } } },
  });
  if (!member) throw new AppError("Nuk je anëtar i këtij grupi.", 403, "forbidden");
  return member;
}

/** Someone is considered online if they have been seen in the last 90 seconds. */
export const PRESENCE_WINDOW_MS = 90_000;

export function isOnline(lastSeen: Date): boolean {
  return Date.now() - lastSeen.getTime() < PRESENCE_WINDOW_MS;
}

export async function touchPresence(groupId: string, userId: string) {
  await db.studyGroupMember.updateMany({
    where: { groupId, userId },
    data: { lastSeen: new Date() },
  });
}

export interface WireMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  isAI: boolean;
  kind: string;
  quiz?: unknown;
  createdAt: string;
}

export function toWire(
  m: {
    id: string;
    userId: string | null;
    authorName: string;
    text: string;
    isAI: boolean;
    kind: string;
    payload: string | null;
    createdAt: Date;
  },
  viewerId: string
): WireMessage {
  let quiz: unknown;
  if (m.payload) {
    try {
      const parsed = JSON.parse(m.payload);
      quiz = parsed?.questions;
    } catch {
      quiz = undefined;
    }
  }

  return {
    id: m.id,
    authorId: m.userId === viewerId ? "me" : m.isAI ? "ai" : (m.userId ?? "?"),
    authorName: m.authorName,
    text: m.text,
    at: `${`${m.createdAt.getHours()}`.padStart(2, "0")}:${`${m.createdAt.getMinutes()}`.padStart(2, "0")}`,
    isAI: m.isAI,
    kind: m.kind,
    quiz,
    createdAt: m.createdAt.toISOString(),
  };
}
