import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import { createSpace, joinSpace } from "@/server/spaces.ts";
import {
  buildRecap,
  creditSession,
  finishSession,
} from "@/server/space-recap.ts";
import { __resetBus } from "@/server/realtime.ts";

/**
 * Banking a session into personal progress.
 *
 * The property worth guarding hardest is that it happens exactly once. A
 * double click on "Përfundo" handing everyone a second four hours would be
 * both wrong and very hard to notice.
 */

const DOMAIN = "recap.hajdemsojna.test";
const TODAY = "2026-09-19";

let hostId = "";
let friendId = "";

const spaceInput = {
  name: "Algoritme Crew",
  about: "",
  subjectId: null as string | null,
  privacy: "public" as const,
  environment: "biblioteka",
  ambient: "none",
  syncAmbient: false,
  studyMinutes: 50,
  breakMinutes: 10,
  roundCount: 3,
  maxMembers: 8,
  aiSupervisor: false,
  rules: "",
};

async function makeUser(tag: string) {
  const u = await db.user.create({
    data: { email: `${tag}@${DOMAIN}`, name: tag, surname: "S", profile: { create: {} } },
  });
  return u.id;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

/** A space with a running session, and both members in it. */
async function runningSession(over: Partial<typeof spaceInput> = {}) {
  const space = await createSpace(hostId, { ...spaceInput, ...over });
  await joinSpace(friendId, space.id, {});

  const run = await db.studySpaceSession.create({
    data: {
      spaceId: space.id,
      mode: "focus",
      currentRound: 1,
      totalRounds: 3,
      studyMinutes: 50,
      breakMinutes: 10,
      phaseStartedAt: new Date(),
    },
  });

  return { space, run };
}

describe("session recap", () => {
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

  test("credits accumulate per round, per member", async () => {
    const { run } = await runningSession();

    await creditSession(run.id, hostId, 3000, 50);
    await creditSession(run.id, hostId, 3000, 50);
    await creditSession(run.id, friendId, 3000, 50);

    const recap = (await buildRecap(run.id))!;
    const host = recap.members.find((m) => m.userId === hostId)!;
    const friend = recap.members.find((m) => m.userId === friendId)!;

    assert.equal(host.focusSeconds, 6000);
    assert.equal(host.rounds, 2);
    assert.equal(friend.focusSeconds, 3000);
    assert.equal(friend.rounds, 1);
  });

  test("the recap adds everyone's time together", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);
    await creditSession(run.id, friendId, 1500, 25);

    const recap = (await buildRecap(run.id))!;
    assert.equal(recap.collectiveSeconds, 4500);
  });

  test("members are listed by how much they studied", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, friendId, 3000, 50);
    await creditSession(run.id, hostId, 600, 10);

    const recap = (await buildRecap(run.id))!;
    assert.equal(recap.members[0].userId, friendId);
  });

  test("someone who never showed up is listed with nothing, not omitted", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);

    const recap = (await buildRecap(run.id))!;
    const friend = recap.members.find((m) => m.userId === friendId)!;

    assert.equal(friend.focusSeconds, 0);
    assert.equal(friend.attendance, 0);
  });

  test("attendance is a share of what was possible", async () => {
    const { run } = await runningSession();
    // One round of 50 minutes is possible; they were there for half.
    await creditSession(run.id, hostId, 1500, 25);

    const recap = (await buildRecap(run.id))!;
    assert.equal(recap.members.find((m) => m.userId === hostId)!.attendance, 50);
  });

  /* ── Banking into personal progress ────────────────── */

  test("writes a StudySession so the time reaches Progresi", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);

    await finishSession(run.id, TODAY);

    const sessions = await db.studySession.findMany({ where: { userId: hostId } });
    assert.equal(sessions.length, 1);

    const written = sessions[0];
    assert.equal(written.minutes, 50);
    // The shape Progresi counts: done, and not a break.
    assert.equal(written.status, "done");
    assert.equal(written.kind, "grup");
    assert.equal(written.date, TODAY);
  });

  test("banking twice does not pay twice", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);

    await finishSession(run.id, TODAY);
    await finishSession(run.id, TODAY);
    await finishSession(run.id, TODAY);

    const sessions = await db.studySession.findMany({ where: { userId: hostId } });
    assert.equal(sessions.length, 1, "the session was banked more than once");
  });

  test("a second call still returns the recap", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);

    await finishSession(run.id, TODAY);
    const again = await finishSession(run.id, TODAY);

    assert.ok(again, "the recap disappeared on the second call");
    assert.equal(again.members.find((m) => m.userId === hostId)!.focusSeconds, 3000);
  });

  test("each member is credited their own time, not the group's", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 6000, 100);
    await creditSession(run.id, friendId, 1800, 30);

    await finishSession(run.id, TODAY);

    const host = await db.studySession.findFirstOrThrow({ where: { userId: hostId } });
    const friend = await db.studySession.findFirstOrThrow({ where: { userId: friendId } });

    assert.equal(host.minutes, 100);
    assert.equal(friend.minutes, 30);
  });

  test("under a minute is a visit, not a study session", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 20, 0);

    await finishSession(run.id, TODAY);

    assert.equal(await db.studySession.count({ where: { userId: hostId } }), 0);
  });

  test("marks the session ended and credited", async () => {
    const { run } = await runningSession();
    await creditSession(run.id, hostId, 3000, 50);

    await finishSession(run.id, TODAY);

    const after = await db.studySpaceSession.findUniqueOrThrow({
      where: { id: run.id },
    });
    assert.equal(after.mode, "ended");
    assert.ok(after.endedAt);
    assert.ok(after.creditedAt);
  });

  /* ── Subjects ──────────────────────────────────────── */

  test("credits against the member's own subject, never another's", async () => {
    const hostSubject = await db.subject.create({
      data: { userId: hostId, name: "Algoritme" },
    });
    // The friend has their own subject of the same name.
    const friendSubject = await db.subject.create({
      data: { userId: friendId, name: "Algoritme" },
    });

    const { run } = await runningSession({ subjectId: hostSubject.id });
    await creditSession(run.id, hostId, 3000, 50);
    await creditSession(run.id, friendId, 3000, 50);

    await finishSession(run.id, TODAY);

    const host = await db.studySession.findFirstOrThrow({ where: { userId: hostId } });
    const friend = await db.studySession.findFirstOrThrow({ where: { userId: friendId } });

    assert.equal(host.subjectId, hostSubject.id);
    assert.equal(
      friend.subjectId,
      friendSubject.id,
      "the friend was credited against someone else's subject row"
    );
  });

  test("a member with no matching subject still gets the time", async () => {
    const hostSubject = await db.subject.create({
      data: { userId: hostId, name: "Algoritme" },
    });

    const { run } = await runningSession({ subjectId: hostSubject.id });
    await creditSession(run.id, friendId, 3000, 50);

    await finishSession(run.id, TODAY);

    const friend = await db.studySession.findFirstOrThrow({
      where: { userId: friendId },
    });
    assert.equal(friend.subjectId, null);
    assert.equal(friend.minutes, 50, "the time was lost with the subject");
  });

  test("an unknown session is null rather than a crash", async () => {
    assert.equal(await finishSession("no-such-session", TODAY), null);
    assert.equal(await buildRecap("no-such-session"), null);
  });
});
