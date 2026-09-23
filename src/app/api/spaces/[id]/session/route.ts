import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { publish } from "@/server/realtime";
import { sessionCommandInput } from "@/lib/spaces/validation";
import {
  advance,
  end as endSession,
  pause as pauseSession,
  phaseDurationSeconds,
  resume as resumeSession,
  startSession,
  viewSession,
} from "@/lib/spaces/session";
import {
  DISCONNECTED_AFTER_SECONDS,
  POINTS,
  countsAsPresent,
  roundPoints,
  type Activity,
} from "@/lib/spaces/presence";
import {
  SpaceError,
  creditFocus,
  currentSession,
  requireHost,
  saveSession,
  toSessionState,
} from "@/server/spaces";
import { buildRecap, creditSession, finishSession } from "@/server/space-recap";
import { getToday } from "@/lib/server-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The session clock.
 *
 * Only a host or co-host can drive it: a shared timer that any member could
 * pause would not be a shared timer. Members read it through the stream.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const session = await currentSession(id);

    return NextResponse.json({
      ok: true,
      session,
      recap: session ? await buildRecap(session.id) : null,
    });
  });
}

/**
 * Credits everyone who was present for a focus round that just finished.
 *
 * Presence is judged from the heartbeat the browsers have been sending, so a
 * student whose laptop slept through the round earns nothing for it — and is
 * never charged for it either. Nothing here subtracts.
 */
async function creditRound(
  spaceId: string,
  sessionId: string,
  roundSeconds: number
) {
  const members = await db.studySpaceMember.findMany({
    where: { groupId: spaceId },
    select: { userId: true, activity: true, lastSeen: true },
  });

  const now = Date.now();

  for (const m of members) {
    const stale =
      (now - m.lastSeen.getTime()) / 1000 > DISCONNECTED_AFTER_SECONDS;
    const activity: Activity = stale ? "disconnected" : (m.activity as Activity);

    if (!countsAsPresent(activity)) continue;

    // Present for the whole round, as far as the heartbeat can tell. A finer
    // measure would need per-second sampling, which is not worth the writes.
    const points = roundPoints(roundSeconds, roundSeconds);

    await Promise.all([
      // The running total, shown beside their name in the room.
      creditFocus(spaceId, m.userId, roundSeconds, points),
      // The per-session figure the recap reports.
      creditSession(sessionId, m.userId, roundSeconds, points),
    ]);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    try {
      await requireHost(id, user.id);
    } catch (error) {
      if (error instanceof SpaceError) {
        return jsonError(error.message, error.status, error.code);
      }
      throw error;
    }

    const parsed = sessionCommandInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) return jsonError(ERRORS.invalid, 400, "invalid_input");

    const space = await db.studySpace.findUnique({
      where: { id },
      select: { studyMinutes: true, breakMinutes: true, roundCount: true },
    });
    if (!space) return jsonError(ERRORS.notFound, 404, "not_found");

    const run = await db.studySpaceSession.findFirst({
      where: { spaceId: id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    const now = Date.now();
    const action = parsed.data.action;

    if (action === "start") {
      if (run) {
        return jsonError("Sesioni ka filluar tashmë.", 409, "already_running");
      }

      const state = startSession(
        {
          studyMinutes: space.studyMinutes,
          breakMinutes: space.breakMinutes,
          rounds: space.roundCount,
        },
        now
      );

      const created = await db.studySpaceSession.create({
        data: {
          spaceId: id,
          mode: state.mode,
          currentRound: state.currentRound,
          totalRounds: state.totalRounds,
          studyMinutes: state.studyMinutes,
          breakMinutes: state.breakMinutes,
          phaseStartedAt: new Date(now),
          phaseElapsed: 0,
          paused: false,
        },
      });

      const wire = {
        id: created.id,
        at: now,
        ...viewSession(toSessionState(created), now),
      };
      publish(id, { type: "session", session: wire });

      return NextResponse.json({ ok: true, session: wire });
    }

    if (!run) return jsonError("Asnjë sesion aktiv.", 409, "not_running");

    const state = toSessionState(run);

    if (action === "pause") {
      return NextResponse.json({
        ok: true,
        session: await saveSession(id, run.id, pauseSession(state, now)),
      });
    }

    if (action === "resume") {
      return NextResponse.json({
        ok: true,
        session: await saveSession(id, run.id, resumeSession(state, now)),
      });
    }

    if (action === "end") {
      const session = await saveSession(id, run.id, endSession(state));
      // Ending is also when the session is banked into everyone's Progresi.
      const recap = await finishSession(run.id, await getToday());
      return NextResponse.json({ ok: true, session, recap });
    }

    // skip: move to the next phase. A focus round that is skipped still pays
    // out, because the people who sat through it did the work.
    if (state.mode === "focus") {
      await creditRound(id, run.id, phaseDurationSeconds(state));
    }

    const next = advance(state, now);
    const wire = await saveSession(id, run.id, next);

    // The last round just finished: pay the completion bonus and bank it.
    if (next.mode === "ended") {
      await db.studySpaceMember.updateMany({
        where: { groupId: id },
        data: { focusPoints: { increment: POINTS.sessionCompleted } },
      });

      const recap = await finishSession(run.id, await getToday());
      return NextResponse.json({ ok: true, session: wire, recap });
    }

    return NextResponse.json({ ok: true, session: wire });
  });
}
