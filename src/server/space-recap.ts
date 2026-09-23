import "server-only";
import { db } from "@/lib/db";
import { POINTS } from "@/lib/spaces/presence";
import { summariseGroupSession } from "@/lib/ai/tasks";
import { publish } from "./realtime";

/**
 * Ending a session, and making it count.
 *
 * Until this existed, a study space was a sealed room: students could sit in
 * it for four hours and their Progresi page would show nothing, because that
 * page counts StudySession rows and a space wrote none. This writes them —
 * one per member, with the focus time they actually earned — so an evening
 * spent studying together lands in the same place as an evening spent alone.
 *
 * Banking is idempotent. `creditedAt` is the guard: a session can be ended
 * twice by a double click or a retry, and the second attempt must not hand
 * everybody a second helping of minutes.
 */

export interface MemberRecap {
  userId: string;
  name: string;
  focusSeconds: number;
  points: number;
  rounds: number;
  goal: string;
  goalDone: boolean;
  /** Share of the session's focus time this member was present for, 0..100. */
  attendance: number;
}

export interface SessionRecap {
  sessionId: string;
  spaceId: string;
  spaceName: string;
  startedAt: string;
  endedAt: string | null;
  /** Wall-clock length of the whole session, in minutes. */
  totalMinutes: number;
  roundsDone: number;
  roundsPlanned: number;
  /** Everyone's focus time added together. */
  collectiveSeconds: number;
  members: MemberRecap[];
  /** Null when the AI supervisor is off or the model was unreachable. */
  summary: string | null;
}

/** Adds one round's worth of credit to a member's per-session tally. */
export async function creditSession(
  sessionId: string,
  userId: string,
  seconds: number,
  points: number
): Promise<void> {
  await db.sessionCredit.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, seconds, points, rounds: 1 },
    update: {
      seconds: { increment: seconds },
      points: { increment: points },
      rounds: { increment: 1 },
    },
  });
}

/**
 * Builds the recap for a session, whether or not it has been banked.
 *
 * Read-only, so the room can show a live "how are we doing" panel using the
 * same numbers the final recap will report.
 */
export async function buildRecap(sessionId: string): Promise<SessionRecap | null> {
  const run = await db.studySpaceSession.findUnique({
    where: { id: sessionId },
    include: {
      credits: true,
      space: {
        select: {
          id: true,
          name: true,
          members: {
            select: {
              userId: true,
              studyGoal: true,
              goalDone: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!run) return null;

  const creditByUser = new Map(run.credits.map((c) => [c.userId, c]));

  // What one member could have earned: every focus round, in full.
  const roundSeconds = run.studyMinutes * 60;
  const possible = roundSeconds * Math.max(1, run.currentRound);

  const members: MemberRecap[] = run.space.members.map((m) => {
    const credit = creditByUser.get(m.userId);
    const seconds = credit?.seconds ?? 0;

    return {
      userId: m.userId,
      name: m.user.name,
      focusSeconds: seconds,
      points: credit?.points ?? 0,
      rounds: credit?.rounds ?? 0,
      goal: m.studyGoal,
      goalDone: m.goalDone,
      attendance: possible > 0 ? Math.round((seconds / possible) * 100) : 0,
    };
  });

  const endedAt = run.endedAt ?? null;
  const totalMinutes = Math.round(
    ((endedAt ?? new Date()).getTime() - run.startedAt.getTime()) / 60_000
  );

  return {
    sessionId: run.id,
    spaceId: run.space.id,
    spaceName: run.space.name,
    startedAt: run.startedAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    totalMinutes,
    // A round only counts as done once its focus phase has finished.
    roundsDone: run.mode === "ended" ? run.currentRound : run.currentRound - 1,
    roundsPlanned: run.totalRounds,
    collectiveSeconds: members.reduce((sum, m) => sum + m.focusSeconds, 0),
    members: members.sort((a, b) => b.focusSeconds - a.focusSeconds),
    summary: null,
  };
}

/**
 * Banks a finished session into everyone's personal progress.
 *
 * Each member who actually studied gets a StudySession row — the same shape
 * the solo planner writes — so group time flows into weekly minutes, streaks
 * and per-subject totals with no special cases anywhere downstream.
 *
 * Returns the recap, or null if there was nothing to bank.
 */
export async function finishSession(
  sessionId: string,
  today: string
): Promise<SessionRecap | null> {
  const run = await db.studySpaceSession.findUnique({
    where: { id: sessionId },
    include: {
      credits: true,
      space: { select: { id: true, name: true, subjectId: true, subjectName: true } },
    },
  });
  if (!run) return null;

  // Already banked. Return the recap, but do not pay anybody twice.
  if (run.creditedAt) return buildRecap(sessionId);

  const now = new Date();

  await db.studySpaceSession.update({
    where: { id: sessionId },
    data: {
      mode: "ended",
      endedAt: run.endedAt ?? now,
      creditedAt: now,
      phaseStartedAt: null,
    },
  });

  for (const credit of run.credits) {
    const minutes = Math.round(credit.seconds / 60);
    // Under a minute is not a study session, it is a visit.
    if (minutes < 1) continue;

    await db.studySession.create({
      data: {
        userId: credit.userId,
        // Only if the space is tied to a subject the member owns; otherwise
        // the time still counts, just not against a subject.
        subjectId: await ownedSubjectId(credit.userId, run.space.subjectId),
        kind: "grup",
        title: run.space.name,
        objective: run.space.subjectName,
        date: today,
        start: "00:00",
        minutes,
        status: "done",
        why: "Sesion në grup",
        groupId: run.space.id,
        source: "rule",
      },
    });
  }

  const recap = await buildRecap(sessionId);
  if (!recap) return null;

  const withSummary = { ...recap, summary: await summarise(sessionId, recap) };
  publish(run.space.id, { type: "session", session: { recap: withSummary } });

  return withSummary;
}

/**
 * The AI's closing word, or null.
 *
 * Never allowed to stop a session being banked: the minutes are the point
 * and the sentence is a garnish, so an unreachable model, a missing key or
 * a supervisor that is switched off all just mean no summary.
 */
async function summarise(
  sessionId: string,
  recap: SessionRecap
): Promise<string | null> {
  const run = await db.studySpaceSession.findUnique({
    where: { id: sessionId },
    select: {
      space: {
        select: { ownerId: true, aiSupervisor: true, subjectName: true },
      },
    },
  });

  if (!run?.space.aiSupervisor) return null;

  try {
    return await summariseGroupSession(run.space.ownerId, {
      spaceName: recap.spaceName,
      subject: run.space.subjectName,
      totalMinutes: recap.totalMinutes,
      roundsDone: recap.roundsDone,
      roundsPlanned: recap.roundsPlanned,
      memberCount: recap.members.length,
      collectiveMinutes: Math.round(recap.collectiveSeconds / 60),
      // Percentages only, never names: the prompt must not be able to
      // single anyone out even if it wanted to.
      attendance: recap.members.map((m) => m.attendance),
      goals: recap.members.map((m) => m.goal).filter(Boolean),
    });
  } catch (error) {
    console.error("[space-recap] summary", error);
    return null;
  }
}

/**
 * A subject id only if this member owns it.
 *
 * The space's subject belongs to whoever created the room; crediting another
 * student's hours against it would be writing into a row that is not theirs.
 * Matching by name gives them their own copy of the same subject when they
 * have one.
 */
async function ownedSubjectId(
  userId: string,
  spaceSubjectId: string | null
): Promise<string | null> {
  if (!spaceSubjectId) return null;

  const theirs = await db.subject.findFirst({
    where: { id: spaceSubjectId, userId },
    select: { id: true },
  });
  if (theirs) return theirs.id;

  const source = await db.subject.findUnique({
    where: { id: spaceSubjectId },
    select: { name: true },
  });
  if (!source) return null;

  const match = await db.subject.findFirst({
    where: { userId, name: source.name },
    select: { id: true },
  });
  return match?.id ?? null;
}

/** Points for finishing the whole thing, paid once. */
export const SESSION_COMPLETE_POINTS = POINTS.sessionCompleted;
