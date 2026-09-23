import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import {
  createSpace,
  currentSession,
  heartbeat,
  joinSpace,
  listMembers,
  requireHost,
  saveSession,
  toSessionState,
} from "@/server/spaces.ts";
import {
  __resetBus,
  subscribe,
  type RoomEvent,
} from "@/server/realtime.ts";
import { advance, startSession, viewSession } from "@/lib/spaces/session.ts";
import { environmentFor } from "@/lib/spaces/environments.ts";
import { countsAsPresent } from "@/lib/spaces/presence.ts";

/**
 * The success flow from the brief, end to end against the real database.
 *
 * This is the test that would catch the whole feature being subtly broken:
 * create a private room, have a friend join by code, both sit down, run the
 * clock through a round, and check that going away stops credit without
 * stopping anyone else.
 */

const DOMAIN = "flow.hajdemsojna.test";

let hostId = "";
let friendId = "";

async function makeUser(tag: string) {
  const u = await db.user.create({
    data: {
      email: `${tag}@${DOMAIN}`,
      name: tag,
      surname: "Student",
      profile: { create: {} },
    },
  });
  return u.id;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

describe("the full Mso Bashkë flow", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    __resetBus();
    hostId = await makeUser("host");
    friendId = await makeUser("friend");
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  test("create, invite, join, sit, study, step away, come back", async () => {
    /* 1–9. The host builds a private Biblioteka room, 50/10 x 5, AI on. */
    const space = await createSpace(hostId, {
      name: "Night Study Crew",
      about: "Përsëritje",
      subjectId: null,
      privacy: "private",
      environment: "biblioteka",
      ambient: "rain",
      syncAmbient: false,
      studyMinutes: 50,
      breakMinutes: 10,
      roundCount: 5,
      maxMembers: 8,
      aiSupervisor: true,
      rules: "Shqip",
    });

    assert.equal(space.environment, "biblioteka");
    assert.equal(space.aiSupervisor, true);
    assert.equal(space.totalMinutes, 290);

    /* 10–12. A code is generated and the friend uses it. */
    assert.ok(space.inviteCode);
    await joinSpace(friendId, space.id, { code: space.inviteCode! });

    const members = await listMembers(space.id, hostId);
    assert.equal(members.length, 2);

    /* 13. Both have a character, even without building one. */
    for (const m of members) {
      assert.ok(m.avatar, `${m.name} has no avatar`);
      assert.ok(m.avatar.skin >= 0);
    }

    /* 14–16. They sit at the same table. */
    const env = environmentFor(space.environment);
    const table = env.seats.filter((s) => s.tableId === "t1");
    assert.ok(table.length >= 2, "the main table needs at least two seats");

    await db.studySpaceMember.updateMany({
      where: { groupId: space.id, userId: hostId },
      data: { seatId: table[0].id, avatarX: table[0].x, avatarY: table[0].y },
    });
    await db.studySpaceMember.updateMany({
      where: { groupId: space.id, userId: friendId },
      data: { seatId: table[1].id, avatarX: table[1].x, avatarY: table[1].y },
    });

    const seated = await listMembers(space.id, hostId);
    const tables = new Set(
      seated.map((m) => env.seats.find((s) => s.id === m.seatId)?.tableId)
    );
    assert.equal(tables.size, 1, "they should share one table");

    /* 17. They say what they are working on. */
    await db.studySpaceMember.updateMany({
      where: { groupId: space.id, userId: hostId },
      data: { studySubject: "Algoritme", studyTopic: "Dynamic Programming" },
    });

    const withStatus = await listMembers(space.id, hostId);
    assert.equal(
      withStatus.find((m) => m.userId === hostId)?.studyTopic,
      "Dynamic Programming"
    );

    /* 18–19. Only the host may start, and the clock begins. */
    await assert.rejects(() => requireHost(space.id, friendId));
    await requireHost(space.id, hostId);

    const now = Date.now();
    const state = startSession(
      { studyMinutes: 50, breakMinutes: 10, rounds: 5 },
      now
    );
    const run = await db.studySpaceSession.create({
      data: {
        spaceId: space.id,
        mode: state.mode,
        currentRound: state.currentRound,
        totalRounds: state.totalRounds,
        studyMinutes: state.studyMinutes,
        breakMinutes: state.breakMinutes,
        phaseStartedAt: new Date(now),
      },
    });

    const live = await currentSession(space.id);
    assert.ok(live);
    assert.equal(live.mode, "focus");
    assert.equal(live.currentRound, 1);
    assert.ok(live.remaining > 49 * 60);

    /* 20. Both are active. */
    await heartbeat(space.id, hostId, { activity: "active", interacted: true });
    await heartbeat(space.id, friendId, { activity: "active", interacted: true });

    const active = await listMembers(space.id, hostId);
    assert.ok(active.every((m) => m.activity === "active"));

    /* 21–22. The friend goes away; credit stops for them alone. */
    await heartbeat(space.id, friendId, { activity: "away", interacted: false });

    const mixed = await listMembers(space.id, hostId);
    const hostRow = mixed.find((m) => m.userId === hostId)!;
    const friendRow = mixed.find((m) => m.userId === friendId)!;

    assert.equal(countsAsPresent(hostRow.activity), true);
    assert.equal(countsAsPresent(friendRow.activity), false);

    // The group clock is untouched by one person leaving.
    const stillRunning = await currentSession(space.id);
    assert.equal(stillRunning?.mode, "focus");
    assert.equal(stillRunning?.currentRound, 1);

    /* 23. They come back. */
    await heartbeat(space.id, friendId, { activity: "active", interacted: true });
    const back = await listMembers(space.id, hostId);
    assert.equal(
      back.find((m) => m.userId === friendId)?.activity,
      "active"
    );

    /* 27–30. The round ends and a break begins. */
    const next = advance(toSessionState(run), now + 50 * 60_000);
    const saved = await saveSession(space.id, run.id, next);

    assert.equal(saved.mode, "break");
    assert.equal(saved.currentRound, 1);
    assert.ok(saved.remaining > 9 * 60);
  });

  test("the clock reaches the end after exactly the configured rounds", async () => {
    const space = await createSpace(hostId, {
      name: "Short",
      about: "",
      subjectId: null,
      privacy: "public",
      environment: "minimal",
      ambient: "none",
      syncAmbient: false,
      studyMinutes: 25,
      breakMinutes: 5,
      roundCount: 2,
      maxMembers: 4,
      aiSupervisor: false,
      rules: "",
    });

    const now = Date.now();
    let state = startSession(
      { studyMinutes: 25, breakMinutes: 5, rounds: 2 },
      now
    );
    const run = await db.studySpaceSession.create({
      data: {
        spaceId: space.id,
        mode: state.mode,
        currentRound: state.currentRound,
        totalRounds: state.totalRounds,
        studyMinutes: state.studyMinutes,
        breakMinutes: state.breakMinutes,
        phaseStartedAt: new Date(now),
      },
    });

    // focus 1 -> break -> focus 2 -> ended
    for (let i = 0; i < 3; i++) {
      state = advance(state, now);
      await saveSession(space.id, run.id, state);
    }

    assert.equal(state.mode, "ended");

    // An ended run is no longer the current one.
    assert.equal(await currentSession(space.id), null);
  });

  test("a session change is pushed to the room, not polled for", async () => {
    const space = await createSpace(hostId, {
      name: "Push",
      about: "",
      subjectId: null,
      privacy: "public",
      environment: "lab",
      ambient: "none",
      syncAmbient: false,
      studyMinutes: 25,
      breakMinutes: 5,
      roundCount: 2,
      maxMembers: 4,
      aiSupervisor: false,
      rules: "",
    });

    const seen: RoomEvent[] = [];
    subscribe(space.id, (e) => seen.push(e));

    const now = Date.now();
    const state = startSession(
      { studyMinutes: 25, breakMinutes: 5, rounds: 2 },
      now
    );
    const run = await db.studySpaceSession.create({
      data: {
        spaceId: space.id,
        mode: state.mode,
        currentRound: state.currentRound,
        totalRounds: state.totalRounds,
        studyMinutes: state.studyMinutes,
        breakMinutes: state.breakMinutes,
        phaseStartedAt: new Date(now),
      },
    });

    await saveSession(space.id, run.id, advance(state, now));

    const sessionEvents = seen.filter((e) => e.type === "session");
    assert.equal(sessionEvents.length, 1, "the room was not told");
  });

  test("presence changes reach the room as one roster push", async () => {
    const space = await createSpace(hostId, {
      name: "Roster",
      about: "",
      subjectId: null,
      privacy: "public",
      environment: "kafe",
      ambient: "none",
      syncAmbient: false,
      studyMinutes: 25,
      breakMinutes: 5,
      roundCount: 1,
      maxMembers: 4,
      aiSupervisor: false,
      rules: "",
    });

    const seen: RoomEvent[] = [];
    subscribe(space.id, (e) => seen.push(e));

    // Joining is a roster change, so it should announce itself.
    await joinSpace(friendId, space.id, {});

    const presence = seen.filter((e) => e.type === "presence");
    assert.equal(presence.length, 1);

    const payload = presence[0] as Extract<RoomEvent, { type: "presence" }>;
    assert.equal(payload.members.length, 2);
  });

  test("a stale heartbeat reads as disconnected whatever the row says", async () => {
    const space = await createSpace(hostId, {
      name: "Stale",
      about: "",
      subjectId: null,
      privacy: "public",
      environment: "shi",
      ambient: "none",
      syncAmbient: false,
      studyMinutes: 25,
      breakMinutes: 5,
      roundCount: 1,
      maxMembers: 4,
      aiSupervisor: false,
      rules: "",
    });

    // The row claims to be active, but nothing has been heard for an hour.
    await db.studySpaceMember.updateMany({
      where: { groupId: space.id, userId: hostId },
      data: { activity: "active", lastSeen: new Date(Date.now() - 3600_000) },
    });

    const members = await listMembers(space.id, hostId);
    assert.equal(members[0].activity, "disconnected");
  });

  test("the view of a running session is the same for every member", async () => {
    const space = await createSpace(hostId, {
      name: "Agree",
      about: "",
      subjectId: null,
      privacy: "public",
      environment: "kasolle",
      ambient: "none",
      syncAmbient: false,
      studyMinutes: 50,
      breakMinutes: 10,
      roundCount: 3,
      maxMembers: 4,
      aiSupervisor: false,
      rules: "",
    });
    await joinSpace(friendId, space.id, {});

    const now = Date.now();
    const run = await db.studySpaceSession.create({
      data: {
        spaceId: space.id,
        mode: "focus",
        currentRound: 1,
        totalRounds: 3,
        studyMinutes: 50,
        breakMinutes: 10,
        phaseStartedAt: new Date(now - 10 * 60_000),
      },
    });

    // Both read the same stored row at the same instant.
    const at = now;
    const a = viewSession(toSessionState(run), at);
    const b = viewSession(toSessionState(run), at);

    assert.deepEqual(a, b);
    assert.equal(a.remaining, 40 * 60);
  });
});
