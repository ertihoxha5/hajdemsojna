import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { parseAvatar, avatarFromSeed, type Avatar } from "@/lib/avatar";
import {
  DEFAULT_ENVIRONMENT,
  environmentFor,
  sessionTotalMinutes,
} from "@/lib/spaces/environments";
import {
  DISCONNECTED_AFTER_SECONDS,
  groupFocus,
  type Activity,
} from "@/lib/spaces/presence";
import {
  viewSession,
  type SessionState,
  type SessionView,
} from "@/lib/spaces/session";
import { publish } from "./realtime";

/**
 * Study space data access.
 *
 * Every read and write resolves the space through the caller's own
 * membership, so a space id from a request body is never enough on its own.
 * The one exception is `findByInviteCode`, which deliberately returns only the
 * few fields needed to render a join prompt — a code should let you see what
 * you are about to join, not read the room's messages.
 */

/* ============================================================
   Authorisation
   ============================================================ */

export class SpaceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 403, code = "forbidden") {
    super(message);
    this.name = "SpaceError";
    this.status = status;
    this.code = code;
  }
}

export type Role = "owner" | "cohost" | "member";

export interface Membership {
  spaceId: string;
  userId: string;
  role: Role;
}

/** Throws unless the user is a member. The gate for every room operation. */
export async function requireMember(
  spaceId: string,
  userId: string
): Promise<Membership> {
  const row = await db.studySpaceMember.findUnique({
    where: { groupId_userId: { groupId: spaceId, userId } },
    select: { role: true },
  });

  if (!row) {
    throw new SpaceError("Nuk je anëtar i kësaj hapësire.", 403, "not_member");
  }
  return { spaceId, userId, role: row.role as Role };
}

/** Throws unless the user can drive the session and room settings. */
export async function requireHost(
  spaceId: string,
  userId: string
): Promise<Membership> {
  const member = await requireMember(spaceId, userId);
  if (member.role === "member") {
    throw new SpaceError(
      "Vetëm host-i mund ta bëjë këtë.",
      403,
      "not_host"
    );
  }
  return member;
}

/* ============================================================
   Shapes sent to the browser
   ============================================================ */

export interface MemberWire {
  userId: string;
  name: string;
  initials: string;
  isMe: boolean;
  role: Role;
  avatar: Avatar;
  x: number;
  y: number;
  seatId: string | null;
  activity: Activity;
  studySubject: string;
  studyTopic: string;
  studyGoal: string;
  goalDone: boolean;
  focusSeconds: number;
  focusPoints: number;
}

export interface SpaceWire {
  id: string;
  name: string;
  about: string;
  subjectId: string | null;
  subjectName: string;
  privacy: string;
  environment: string;
  ambient: string;
  syncAmbient: boolean;
  studyMinutes: number;
  breakMinutes: number;
  roundCount: number;
  maxMembers: number;
  aiSupervisor: boolean;
  rules: string[];
  locked: boolean;
  ownerId: string;
  inviteCode: string | null;
  memberCount: number;
  totalMinutes: number;
}

type MemberRow = {
  userId: string;
  role: string;
  avatarX: number;
  avatarY: number;
  seatId: string | null;
  activity: string;
  lastActiveAt: Date;
  lastSeen: Date;
  studySubject: string;
  studyTopic: string;
  studyGoal: string;
  goalDone: boolean;
  focusSeconds: number;
  focusPoints: number;
  user: { name: string; surname: string; profile: { avatar: string } | null };
};

/**
 * Resolves a stored activity against the clock.
 *
 * A row can say "active" long after the browser vanished, because the last
 * thing it did was write that. Anyone whose heartbeat has gone stale is
 * reported as disconnected regardless of what the column claims.
 */
function liveActivity(row: MemberRow, now: number): Activity {
  const stale =
    (now - row.lastSeen.getTime()) / 1000 > DISCONNECTED_AFTER_SECONDS;
  if (stale) return "disconnected";

  const stored = row.activity as Activity;
  return ["active", "idle", "away", "disconnected"].includes(stored)
    ? stored
    : "disconnected";
}

function memberWire(row: MemberRow, meId: string, now: number): MemberWire {
  const avatar = row.user.profile?.avatar
    ? parseAvatar(row.user.profile.avatar)
    : avatarFromSeed(row.userId);

  return {
    userId: row.userId,
    name: row.user.name,
    initials:
      `${row.user.name[0] ?? "?"}${row.user.surname[0] ?? ""}`.toUpperCase(),
    isMe: row.userId === meId,
    role: row.role as Role,
    avatar,
    x: row.avatarX,
    y: row.avatarY,
    seatId: row.seatId,
    activity: liveActivity(row, now),
    studySubject: row.studySubject,
    studyTopic: row.studyTopic,
    studyGoal: row.studyGoal,
    goalDone: row.goalDone,
    focusSeconds: row.focusSeconds,
    focusPoints: row.focusPoints,
  };
}

const MEMBER_SELECT = {
  userId: true,
  role: true,
  avatarX: true,
  avatarY: true,
  seatId: true,
  activity: true,
  lastActiveAt: true,
  lastSeen: true,
  studySubject: true,
  studyTopic: true,
  studyGoal: true,
  goalDone: true,
  focusSeconds: true,
  focusPoints: true,
  user: {
    select: {
      name: true,
      surname: true,
      profile: { select: { avatar: true } },
    },
  },
} as const;

export async function listMembers(
  spaceId: string,
  meId: string
): Promise<MemberWire[]> {
  const rows = await db.studySpaceMember.findMany({
    where: { groupId: spaceId },
    select: MEMBER_SELECT,
    orderBy: { joinedAt: "asc" },
  });

  const now = Date.now();
  return rows.map((r) => memberWire(r as MemberRow, meId, now));
}

/** Pushes the current roster to everyone connected. */
export async function broadcastPresence(spaceId: string): Promise<void> {
  const rows = await db.studySpaceMember.findMany({
    where: { groupId: spaceId },
    select: MEMBER_SELECT,
    orderBy: { joinedAt: "asc" },
  });

  const now = Date.now();
  // Sent with no "me": each client marks itself by comparing userId, so one
  // payload serves every connection rather than one render per member.
  publish(spaceId, {
    type: "presence",
    members: rows.map((r) => memberWire(r as MemberRow, "", now)),
  });
}

export function spaceWire(
  space: {
    id: string;
    name: string;
    about: string;
    subjectId: string | null;
    subjectName: string;
    privacy: string;
    environment: string;
    ambient: string;
    syncAmbient: boolean;
    studyMinutes: number;
    breakMinutes: number;
    roundCount: number;
    maxMembers: number;
    aiSupervisor: boolean;
    rules: string;
    locked: boolean;
    ownerId: string;
    inviteCode: string;
  },
  options: { memberCount: number; includeCode: boolean }
): SpaceWire {
  return {
    id: space.id,
    name: space.name,
    about: space.about,
    subjectId: space.subjectId,
    subjectName: space.subjectName,
    privacy: space.privacy,
    environment: space.environment,
    ambient: space.ambient,
    syncAmbient: space.syncAmbient,
    studyMinutes: space.studyMinutes,
    breakMinutes: space.breakMinutes,
    roundCount: space.roundCount,
    maxMembers: space.maxMembers,
    aiSupervisor: space.aiSupervisor,
    rules: space.rules.split("\n").map((r) => r.trim()).filter(Boolean),
    locked: space.locked,
    ownerId: space.ownerId,
    // The code is a credential: only members ever see it.
    inviteCode: options.includeCode ? space.inviteCode : null,
    memberCount: options.memberCount,
    totalMinutes: sessionTotalMinutes(
      space.studyMinutes,
      space.breakMinutes,
      space.roundCount
    ),
  };
}

/* ============================================================
   Creating and joining
   ============================================================ */

/** Six characters, no vowels and no look-alikes, so codes can be read aloud. */
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";

function makeCode(): string {
  // Bytes rather than a token string: randomToken returns base64url, whose
  // alphabet does not survive being read as hex.
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const taken = await db.studySpace.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  // Astronomically unlikely; better to fail loudly than to loop forever.
  throw new SpaceError("Nuk u gjenerua dot një kod.", 500, "code_exhausted");
}

export interface CreateSpaceInput {
  name: string;
  about: string;
  subjectId: string | null;
  privacy: "public" | "private" | "friends";
  environment: string;
  ambient: string;
  syncAmbient: boolean;
  studyMinutes: number;
  breakMinutes: number;
  roundCount: number;
  maxMembers: number;
  aiSupervisor: boolean;
  rules: string;
}

export async function createSpace(
  userId: string,
  input: CreateSpaceInput
): Promise<SpaceWire> {
  // Only a subject the creator actually owns may be attached.
  const subject = input.subjectId
    ? await db.subject.findFirst({
        where: { id: input.subjectId, userId },
        select: { id: true, name: true },
      })
    : null;

  const env = environmentFor(input.environment);

  const space = await db.studySpace.create({
    data: {
      name: input.name,
      about: input.about,
      ownerId: userId,
      subjectId: subject?.id ?? null,
      subjectName: subject?.name ?? "",
      privacy: input.privacy,
      environment: env.key,
      ambient: input.ambient,
      syncAmbient: input.syncAmbient,
      studyMinutes: input.studyMinutes,
      breakMinutes: input.breakMinutes,
      roundCount: input.roundCount,
      maxMembers: input.maxMembers,
      aiSupervisor: input.aiSupervisor,
      rules: input.rules,
      inviteCode: await uniqueCode(),
      members: {
        create: {
          userId,
          role: "owner",
          // The host starts standing near the middle of the room.
          avatarX: Math.floor(env.cols / 2),
          avatarY: Math.floor(env.rows / 2),
        },
      },
    },
  });

  return spaceWire(space, { memberCount: 1, includeCode: true });
}

/** The little a code buys you: enough to decide whether to join. */
export async function findByInviteCode(code: string) {
  const space = await db.studySpace.findUnique({
    where: { inviteCode: code.trim().toUpperCase() },
    select: {
      id: true,
      name: true,
      about: true,
      subjectName: true,
      environment: true,
      privacy: true,
      maxMembers: true,
      locked: true,
      rules: true,
      _count: { select: { members: true } },
    },
  });
  if (!space) return null;

  return {
    id: space.id,
    name: space.name,
    about: space.about,
    subjectName: space.subjectName,
    environment: space.environment,
    privacy: space.privacy,
    memberCount: space._count.members,
    maxMembers: space.maxMembers,
    locked: space.locked,
    rules: space.rules.split("\n").map((r) => r.trim()).filter(Boolean),
  };
}

/**
 * Joins a space, or returns the existing membership.
 *
 * A private space needs the code. A friends-only space needs an accepted
 * friendship with the host. A public one needs neither — but all three still
 * respect the capacity and the lock.
 */
export async function joinSpace(
  userId: string,
  spaceId: string,
  options: { code?: string } = {}
): Promise<{ joined: boolean }> {
  const space = await db.studySpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      ownerId: true,
      privacy: true,
      inviteCode: true,
      maxMembers: true,
      locked: true,
      environment: true,
      _count: { select: { members: true } },
    },
  });
  if (!space) throw new SpaceError("Hapësira nuk u gjet.", 404, "not_found");

  const existing = await db.studySpaceMember.findUnique({
    where: { groupId_userId: { groupId: spaceId, userId } },
    select: { id: true },
  });
  if (existing) return { joined: false };

  if (space.privacy === "private") {
    const given = (options.code ?? "").trim().toUpperCase();
    if (given !== space.inviteCode) {
      throw new SpaceError("Kodi nuk është i saktë.", 403, "bad_code");
    }
  }

  if (space.privacy === "friends") {
    const friendship = await db.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: space.ownerId },
          { requesterId: space.ownerId, addresseeId: userId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw new SpaceError(
        "Kjo hapësirë është vetëm për shokët e host-it.",
        403,
        "not_friend"
      );
    }
  }

  if (space.locked) {
    throw new SpaceError("Hapësira është e mbyllur.", 403, "locked");
  }
  if (space._count.members >= space.maxMembers) {
    throw new SpaceError("Hapësira është plot.", 403, "full");
  }

  const env = environmentFor(space.environment);
  await db.studySpaceMember.create({
    data: {
      groupId: spaceId,
      userId,
      role: "member",
      avatarX: Math.floor(env.cols / 2),
      avatarY: env.rows - 2,
    },
  });

  await broadcastPresence(spaceId);
  return { joined: true };
}

/* ============================================================
   Discovery
   ============================================================ */

export interface SpaceCard {
  id: string;
  name: string;
  subjectName: string;
  environment: string;
  privacy: string;
  memberCount: number;
  maxMembers: number;
  isMember: boolean;
  /** Null when no session is running. */
  session: { mode: string; round: number; totalRounds: number; remaining: number } | null;
  topic: string;
  groupFocus: number;
}

async function cardsFor(
  spaceIds: string[],
  userId: string
): Promise<Map<string, SpaceCard>> {
  if (!spaceIds.length) return new Map();

  const [spaces, runs, memberships] = await Promise.all([
    db.studySpace.findMany({
      where: { id: { in: spaceIds } },
      select: {
        id: true,
        name: true,
        subjectName: true,
        environment: true,
        privacy: true,
        maxMembers: true,
        members: {
          select: { userId: true, activity: true, lastSeen: true, studyTopic: true },
        },
      },
    }),
    db.studySpaceSession.findMany({
      where: { spaceId: { in: spaceIds }, endedAt: null },
      orderBy: { startedAt: "desc" },
    }),
    db.studySpaceMember.findMany({
      where: { groupId: { in: spaceIds }, userId },
      select: { groupId: true },
    }),
  ]);

  const runBySpace = new Map(runs.map((r) => [r.spaceId, r]));
  const mine = new Set(memberships.map((m) => m.groupId));
  const now = Date.now();

  const out = new Map<string, SpaceCard>();
  for (const space of spaces) {
    const run = runBySpace.get(space.id);
    const view = run
      ? viewSession(
          {
            mode: run.mode as SessionState["mode"],
            currentRound: run.currentRound,
            totalRounds: run.totalRounds,
            studyMinutes: run.studyMinutes,
            breakMinutes: run.breakMinutes,
            phaseStartedAt: run.phaseStartedAt?.getTime() ?? null,
            phaseElapsed: run.phaseElapsed,
            paused: run.paused,
          },
          now
        )
      : null;

    const activities = space.members.map((m) =>
      (now - m.lastSeen.getTime()) / 1000 > DISCONNECTED_AFTER_SECONDS
        ? ("disconnected" as Activity)
        : (m.activity as Activity)
    );

    // The topic most people in the room are on, as the room's subject line.
    const topics = space.members.map((m) => m.studyTopic).filter(Boolean);

    out.set(space.id, {
      id: space.id,
      name: space.name,
      subjectName: space.subjectName,
      environment: space.environment,
      privacy: space.privacy,
      memberCount: space.members.length,
      maxMembers: space.maxMembers,
      isMember: mine.has(space.id),
      session:
        view && view.mode !== "ended"
          ? {
              mode: view.mode,
              round: view.currentRound,
              totalRounds: view.totalRounds,
              remaining: view.remaining,
            }
          : null,
      topic: topics[0] ?? "",
      groupFocus: groupFocus(activities),
    });
  }

  return out;
}

export interface Discovery {
  mine: SpaceCard[];
  live: SpaceCard[];
  publicSpaces: SpaceCard[];
  recommended: SpaceCard[];
}

/**
 * Everything the landing page shows, in one pass.
 *
 * "Recommended" is deliberately simple and explainable: public rooms studying
 * a subject the student actually has. No opaque scoring — a student should be
 * able to tell why a room was suggested.
 */
export async function discover(userId: string): Promise<Discovery> {
  const [memberships, subjects] = await Promise.all([
    db.studySpaceMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
    db.subject.findMany({ where: { userId }, select: { name: true } }),
  ]);

  const mineIds = memberships.map((m) => m.groupId);
  const mySubjects = new Set(subjects.map((s) => s.name.toLowerCase()));

  const publicRows = await db.studySpace.findMany({
    where: { privacy: "public" },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, subjectName: true },
  });

  const allIds = [...new Set([...mineIds, ...publicRows.map((p) => p.id)])];
  const cards = await cardsFor(allIds, userId);

  const mine = mineIds.map((id) => cards.get(id)).filter(Boolean) as SpaceCard[];
  const publicSpaces = publicRows
    .map((p) => cards.get(p.id))
    .filter((c): c is SpaceCard => Boolean(c) && !c!.isMember);

  return {
    mine,
    // "Happening now" spans both: a room you are in that is mid-round is the
    // most relevant thing on the page.
    live: [...mine, ...publicSpaces].filter((c) => c.session !== null),
    publicSpaces,
    recommended: publicSpaces.filter(
      (c) => c.subjectName && mySubjects.has(c.subjectName.toLowerCase())
    ),
  };
}

/* ============================================================
   The running session
   ============================================================ */

export function toSessionState(run: {
  mode: string;
  currentRound: number;
  totalRounds: number;
  studyMinutes: number;
  breakMinutes: number;
  phaseStartedAt: Date | null;
  phaseElapsed: number;
  paused: boolean;
}): SessionState {
  return {
    mode: run.mode as SessionState["mode"],
    currentRound: run.currentRound,
    totalRounds: run.totalRounds,
    studyMinutes: run.studyMinutes,
    breakMinutes: run.breakMinutes,
    phaseStartedAt: run.phaseStartedAt?.getTime() ?? null,
    phaseElapsed: run.phaseElapsed,
    paused: run.paused,
  };
}

export interface SessionWire extends SessionView {
  id: string;
  /**
   * Server time when this snapshot was taken.
   *
   * The client subtracts its own elapsed time since receiving it, so a
   * countdown stays correct between pushes without trusting the browser's
   * clock to agree with the server's in absolute terms.
   */
  at: number;
}

export async function currentSession(
  spaceId: string
): Promise<SessionWire | null> {
  const run = await db.studySpaceSession.findFirst({
    where: { spaceId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return null;

  const now = Date.now();
  return { id: run.id, at: now, ...viewSession(toSessionState(run), now) };
}

/** Writes a new session state back and tells the room. */
export async function saveSession(
  spaceId: string,
  runId: string,
  next: SessionState
): Promise<SessionWire> {
  const updated = await db.studySpaceSession.update({
    where: { id: runId },
    data: {
      mode: next.mode,
      currentRound: next.currentRound,
      phaseStartedAt: next.phaseStartedAt ? new Date(next.phaseStartedAt) : null,
      phaseElapsed: next.phaseElapsed,
      paused: next.paused,
      endedAt: next.mode === "ended" ? new Date() : null,
    },
  });

  const now = Date.now();
  const wire: SessionWire = {
    id: updated.id,
    at: now,
    ...viewSession(toSessionState(updated), now),
  };

  publish(spaceId, { type: "session", session: wire });
  return wire;
}

/* ============================================================
   Presence writes
   ============================================================ */

/**
 * The heartbeat.
 *
 * `interacted` separates "the connection is alive" from "the person is". A tab
 * left open all night keeps the first true and lets the second lapse, which is
 * exactly the distinction credited focus time depends on.
 */
export async function heartbeat(
  spaceId: string,
  userId: string,
  input: { activity: Activity; interacted: boolean }
): Promise<void> {
  await db.studySpaceMember.updateMany({
    where: { groupId: spaceId, userId },
    data: {
      lastSeen: new Date(),
      activity: input.activity,
      ...(input.interacted ? { lastActiveAt: new Date() } : {}),
    },
  });
}

/** Credits focus time. Called only for members who were present. */
export async function creditFocus(
  spaceId: string,
  userId: string,
  seconds: number,
  points: number
): Promise<void> {
  if (seconds <= 0 && points <= 0) return;

  await db.studySpaceMember.updateMany({
    where: { groupId: spaceId, userId },
    data: {
      focusSeconds: { increment: Math.max(0, seconds) },
      focusPoints: { increment: Math.max(0, points) },
    },
  });
}

export const DEFAULT_SPACE_ENVIRONMENT = DEFAULT_ENVIRONMENT;
