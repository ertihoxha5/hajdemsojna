import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { randomToken } from "./crypto";

/**
 * Server-side sessions.
 *
 * The cookie carries an opaque random token, never user data and never a JWT —
 * so a session can be revoked instantly on logout and nothing about the user is
 * readable from the client. Passwords are bcrypt hashes; the plaintext is never
 * stored, logged, or returned.
 */

export const SESSION_COOKIE = "hm_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string, userAgent?: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);

  await db.session.create({
    data: { sessionToken: token, userId, expires, userAgent: userAgent?.slice(0, 250) },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return token;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  surname: string;
  image: string | null;
  onboarded: boolean;
  learnerType: string;
  avatarTone: number;
}

/**
 * The authenticated user, or null. Cached per request so a page that reads it
 * in a layout and again in a page only hits the database once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: { user: { include: { profile: true } } },
  });

  if (!session || session.expires < new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    image: user.image,
    onboarded: !!user.profile?.onboardedAt,
    learnerType: user.profile?.learnerType ?? "universitet",
    avatarTone: user.profile?.avatarTone ?? 0,
  };
});

/** Throws for API routes that must never run unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Nuk je i kyçur.");
    this.name = "UnauthorizedError";
  }
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { sessionToken: token } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Removes every other session for this user — used after a password change. */
export async function destroyOtherSessions(userId: string, keepToken: string) {
  await db.session.deleteMany({
    where: { userId, NOT: { sessionToken: keepToken } },
  });
}
