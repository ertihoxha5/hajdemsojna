import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db.ts";
import {
  SpaceError,
  createSpace,
  discover,
  findByInviteCode,
  joinSpace,
  listMembers,
  requireHost,
  requireMember,
  spaceWire,
} from "@/server/spaces.ts";
import {
  __resetBus,
  listenerCount,
  publish,
  subscribe,
  type RoomEvent,
} from "@/server/realtime.ts";

const DOMAIN = "spaces.hajdemsojna.test";

let hostId = "";
let friendId = "";
let strangerId = "";

const baseInput = {
  name: "Algoritme Crew",
  about: "Përsëritje para kolokviumit",
  subjectId: null,
  privacy: "private" as const,
  environment: "biblioteka",
  ambient: "rain",
  syncAmbient: false,
  studyMinutes: 50,
  breakMinutes: 10,
  roundCount: 5,
  maxMembers: 8,
  aiSupervisor: true,
  rules: "Mikrofoni vetëm gjatë pushimit\nShqip",
};

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

describe("study spaces", () => {
  before(cleanup);
  beforeEach(async () => {
    await cleanup();
    __resetBus();
    hostId = await makeUser("host");
    friendId = await makeUser("friend");
    strangerId = await makeUser("stranger");
  });
  after(async () => {
    await cleanup();
    await db.$disconnect();
  });

  /* ── Creation ─────────────────────────────────────── */

  test("creating a space makes the creator its owner", async () => {
    const space = await createSpace(hostId, baseInput);

    const member = await requireMember(space.id, hostId);
    assert.equal(member.role, "owner");
  });

  test("the invite code is six readable characters", async () => {
    const space = await createSpace(hostId, baseInput);
    assert.ok(space.inviteCode);
    assert.equal(space.inviteCode!.length, 6);
    // No vowels and no look-alikes, so a code can be read down a phone.
    assert.ok(!/[AEIOU01]/.test(space.inviteCode!));
  });

  test("codes are unique across spaces", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const s = await createSpace(hostId, { ...baseInput, name: `Room ${i}` });
      codes.add(s.inviteCode!);
    }
    assert.equal(codes.size, 6);
  });

  test("rules are split into lines for display", async () => {
    const space = await createSpace(hostId, baseInput);
    assert.deepEqual(space.rules, [
      "Mikrofoni vetëm gjatë pushimit",
      "Shqip",
    ]);
  });

  test("total session length excludes the trailing break", async () => {
    const space = await createSpace(hostId, baseInput);
    // 5 x 50 focus + 4 x 10 break = 290
    assert.equal(space.totalMinutes, 290);
  });

  test("a subject belonging to someone else is not attached", async () => {
    const theirs = await db.subject.create({
      data: { userId: strangerId, name: "E HUAJ" },
    });

    const space = await createSpace(hostId, {
      ...baseInput,
      subjectId: theirs.id,
    });
    assert.equal(space.subjectId, null);
  });

  /* ── Authorisation ────────────────────────────────── */

  test("a non-member is refused", async () => {
    const space = await createSpace(hostId, baseInput);
    await assert.rejects(
      () => requireMember(space.id, strangerId),
      (e: unknown) => e instanceof SpaceError && e.code === "not_member"
    );
  });

  test("a plain member cannot act as host", async () => {
    const space = await createSpace(hostId, baseInput);
    await joinSpace(friendId, space.id, { code: space.inviteCode! });

    await assert.rejects(
      () => requireHost(space.id, friendId),
      (e: unknown) => e instanceof SpaceError && e.code === "not_host"
    );
  });

  test("a co-host may act as host", async () => {
    const space = await createSpace(hostId, baseInput);
    await joinSpace(friendId, space.id, { code: space.inviteCode! });
    await db.studySpaceMember.updateMany({
      where: { groupId: space.id, userId: friendId },
      data: { role: "cohost" },
    });

    const m = await requireHost(space.id, friendId);
    assert.equal(m.role, "cohost");
  });

  /* ── Joining ──────────────────────────────────────── */

  test("a private space needs the right code", async () => {
    const space = await createSpace(hostId, baseInput);

    await assert.rejects(
      () => joinSpace(strangerId, space.id, { code: "WRONG1" }),
      (e: unknown) => e instanceof SpaceError && e.code === "bad_code"
    );
    await assert.rejects(
      () => joinSpace(strangerId, space.id, {}),
      (e: unknown) => e instanceof SpaceError && e.code === "bad_code"
    );
  });

  test("the right code gets you in", async () => {
    const space = await createSpace(hostId, baseInput);
    const result = await joinSpace(friendId, space.id, {
      code: space.inviteCode!,
    });

    assert.equal(result.joined, true);
    assert.equal((await requireMember(space.id, friendId)).role, "member");
  });

  test("the code is accepted in lower case", async () => {
    const space = await createSpace(hostId, baseInput);
    await joinSpace(friendId, space.id, {
      code: space.inviteCode!.toLowerCase(),
    });
    assert.ok(await requireMember(space.id, friendId));
  });

  test("a public space needs no code", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "public",
    });
    assert.equal((await joinSpace(strangerId, space.id, {})).joined, true);
  });

  test("a friends-only space refuses a stranger", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "friends",
    });

    await assert.rejects(
      () => joinSpace(strangerId, space.id, {}),
      (e: unknown) => e instanceof SpaceError && e.code === "not_friend"
    );
  });

  test("a friends-only space admits an accepted friend", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "friends",
    });
    await db.friendship.create({
      data: { requesterId: friendId, addresseeId: hostId, status: "accepted" },
    });

    assert.equal((await joinSpace(friendId, space.id, {})).joined, true);
  });

  test("a pending friendship is not enough", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "friends",
    });
    await db.friendship.create({
      data: { requesterId: friendId, addresseeId: hostId, status: "pending" },
    });

    await assert.rejects(
      () => joinSpace(friendId, space.id, {}),
      (e: unknown) => e instanceof SpaceError && e.code === "not_friend"
    );
  });

  test("joining twice does not duplicate the membership", async () => {
    const space = await createSpace(hostId, baseInput);
    await joinSpace(friendId, space.id, { code: space.inviteCode! });
    const second = await joinSpace(friendId, space.id, {
      code: space.inviteCode!,
    });

    assert.equal(second.joined, false);
    assert.equal((await listMembers(space.id, hostId)).length, 2);
  });

  test("a full space is refused", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "public",
      maxMembers: 2,
    });
    await joinSpace(friendId, space.id, {});

    await assert.rejects(
      () => joinSpace(strangerId, space.id, {}),
      (e: unknown) => e instanceof SpaceError && e.code === "full"
    );
  });

  test("a locked space is refused", async () => {
    const space = await createSpace(hostId, {
      ...baseInput,
      privacy: "public",
    });
    await db.studySpace.update({
      where: { id: space.id },
      data: { locked: true },
    });

    await assert.rejects(
      () => joinSpace(friendId, space.id, {}),
      (e: unknown) => e instanceof SpaceError && e.code === "locked"
    );
  });

  /* ── What a code exposes ──────────────────────────── */

  test("a code shows enough to decide, and no more", async () => {
    const space = await createSpace(hostId, baseInput);
    const peek = await findByInviteCode(space.inviteCode!);

    assert.ok(peek);
    assert.equal(peek.name, "Algoritme Crew");
    assert.deepEqual(Object.keys(peek).sort(), [
      "about",
      "environment",
      "id",
      "locked",
      "maxMembers",
      "memberCount",
      "name",
      "privacy",
      "rules",
      "subjectName",
    ]);
  });

  test("an unknown code returns nothing", async () => {
    assert.equal(await findByInviteCode("ZZZZZZ"), null);
  });

  test("the invite code is withheld from non-members", async () => {
    const space = await createSpace(hostId, baseInput);
    const row = await db.studySpace.findUniqueOrThrow({
      where: { id: space.id },
    });

    const asStranger = spaceWire(row, { memberCount: 1, includeCode: false });
    assert.equal(asStranger.inviteCode, null);
  });

  /* ── Discovery ────────────────────────────────────── */

  test("my spaces list the rooms I am in", async () => {
    const space = await createSpace(hostId, baseInput);
    const found = await discover(hostId);

    assert.equal(found.mine.length, 1);
    assert.equal(found.mine[0].id, space.id);
  });

  test("private rooms never appear in public discovery", async () => {
    await createSpace(hostId, baseInput);
    const found = await discover(strangerId);

    assert.equal(found.publicSpaces.length, 0);
    assert.equal(found.mine.length, 0);
  });

  test("public rooms I am already in are not offered again", async () => {
    const space = await createSpace(hostId, { ...baseInput, privacy: "public" });
    const found = await discover(hostId);

    assert.equal(found.mine.length, 1);
    assert.ok(!found.publicSpaces.some((c) => c.id === space.id));
  });

  test("recommendations match a subject the student actually has", async () => {
    await db.subject.create({ data: { userId: strangerId, name: "Algoritme" } });
    const hostSubject = await db.subject.create({
      data: { userId: hostId, name: "Algoritme" },
    });
    await createSpace(hostId, {
      ...baseInput,
      privacy: "public",
      subjectId: hostSubject.id,
    });

    const found = await discover(strangerId);
    assert.equal(found.recommended.length, 1);
  });

  test("nothing is recommended for a subject the student does not take", async () => {
    const hostSubject = await db.subject.create({
      data: { userId: hostId, name: "Kimi Organike" },
    });
    await createSpace(hostId, {
      ...baseInput,
      privacy: "public",
      subjectId: hostSubject.id,
    });

    assert.equal((await discover(strangerId)).recommended.length, 0);
  });
});

/* ============================================================
   The event bus
   ============================================================ */

describe("realtime bus", () => {
  beforeEach(__resetBus);

  test("a subscriber receives what is published to its space", () => {
    const seen: RoomEvent[] = [];
    subscribe("space-a", (e) => seen.push(e));

    publish("space-a", { type: "ai", text: "Round 2 po fillon." });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].type, "ai");
  });

  test("delivery is synchronous — no poll interval in between", () => {
    const seen: RoomEvent[] = [];
    subscribe("space-a", (e) => seen.push(e));

    publish("space-a", { type: "ai", text: "now" });
    // Already there, with nothing awaited.
    assert.equal(seen.length, 1);
  });

  test("spaces are isolated from each other", () => {
    const a: RoomEvent[] = [];
    const b: RoomEvent[] = [];
    subscribe("space-a", (e) => a.push(e));
    subscribe("space-b", (e) => b.push(e));

    publish("space-a", { type: "ai", text: "only a" });

    assert.equal(a.length, 1);
    assert.equal(b.length, 0);
  });

  test("every subscriber in a space is served", () => {
    let count = 0;
    subscribe("space-a", () => count++);
    subscribe("space-a", () => count++);
    subscribe("space-a", () => count++);

    publish("space-a", { type: "ai", text: "all" });
    assert.equal(count, 3);
  });

  test("unsubscribing stops delivery and frees the listener", () => {
    const seen: RoomEvent[] = [];
    const off = subscribe("space-a", (e) => seen.push(e));

    assert.equal(listenerCount("space-a"), 1);
    off();
    assert.equal(listenerCount("space-a"), 0);

    publish("space-a", { type: "ai", text: "gone" });
    assert.equal(seen.length, 0);
  });

  test("publishing into an empty space is harmless", () => {
    assert.doesNotThrow(() => publish("nobody-here", { type: "ai", text: "x" }));
  });

  test("many connections do not trip the listener warning", () => {
    // A study space with a dozen members is normal, not a leak.
    for (let i = 0; i < 24; i++) subscribe("space-a", () => {});
    assert.equal(listenerCount("space-a"), 24);
  });
});
