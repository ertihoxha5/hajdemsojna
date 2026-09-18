import "server-only";
import { db } from "@/lib/db";
import type {
  AppState,
  DayIndex,
  Friend,
  GoalKey,
  Mastery,
  StudyGroup,
} from "@/lib/types";
import { iso } from "@/lib/date";
import { generateReminders } from "./reminders";

/**
 * Builds the client-side AppState for one user, entirely from their own rows.
 *
 * Every query below is filtered by userId — there is no code path that can
 * return another student's subjects, grades, notes or conversations.
 */
export async function loadAppState(userId: string, today: string): Promise<AppState> {
  // Reminders are generated before the read, so anything due today or tomorrow
  // is already in the notification list this call is about to return. It is
  // idempotent, so doing it on every load is safe.
  await generateReminders(userId, today).catch((error) => {
    // A reminder that fails to generate must never stop the app from loading.
    console.error("[state] reminders", error);
  });

  const [user, subjects, lectures, sessions, assignments, exams, grades, materials, notes, goals, availability, notifications, memberships, friendships, conversation, dueCount, cardCount, reviewedTodayCount, quizAttempts] =
    await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        include: { profile: true, settings: true, preference: true },
      }),
      db.subject.findMany({
        where: { userId },
        include: { topics: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      db.lecture.findMany({ where: { userId } }),
      db.studySession.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { start: "asc" }] }),
      db.assignment.findMany({
        where: { userId },
        include: { steps: { orderBy: { position: "asc" } } },
        orderBy: { due: "asc" },
      }),
      db.exam.findMany({ where: { userId }, include: { topics: true }, orderBy: { date: "asc" } }),
      db.grade.findMany({ where: { userId }, orderBy: { date: "asc" } }),
      db.material.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      db.note.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      db.studyGoal.findMany({ where: { userId } }),
      db.availability.findMany({ where: { userId } }),
      db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.studyGroupMember.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              members: { include: { user: { include: { profile: true } } } },
              messages: { orderBy: { createdAt: "asc" }, take: 200 },
              sessions: { orderBy: { date: "asc" } },
            },
          },
        },
      }),
      db.friendship.findMany({
        where: {
          status: "accepted",
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        include: {
          requester: { include: { profile: true, subjects: true } },
          addressee: { include: { profile: true, subjects: true } },
        },
      }),
      db.aIConversation.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
      }),
      // Counts rather than rows: the deck itself is loaded only by /perserit.
      db.flashcard.count({ where: { userId, suspended: false, due: { lte: today } } }),
      db.flashcard.count({ where: { userId } }),
      db.flashcardReview.count({ where: { userId, date: today } }),
      // Recent attempts only: a subject the student has since learned should
      // not be dragged down by how a quiz went two months ago.
      db.quizAttempt.findMany({
        where: { userId, subjectId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { subjectId: true, total: true, correct: true },
      }),
    ]);

  const mySubjectNames = new Set(subjects.map((s) => s.name.toLowerCase()));

  const friends: Friend[] = friendships.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    const mutual = other.subjects
      .filter((s) => mySubjectNames.has(s.name.toLowerCase()))
      .map((s) => s.name);
    return {
      id: other.id,
      name: `${other.name} ${other.surname}`.trim(),
      initials: `${other.name[0] ?? "?"}${other.surname[0] ?? ""}`.toUpperCase(),
      tone: other.profile?.avatarTone ?? 0,
      // Presence is derived from group membership heartbeats; without one the
      // honest answer is offline rather than a fabricated status.
      status: "offline",
      faculty: other.profile?.institution ?? "",
      mutualSubjects: mutual,
      streak: other.profile?.streak ?? 0,
      weeklyMinutes: 0,
    };
  });

  const groups: StudyGroup[] = memberships.map(({ group }) => {
    const next = group.sessions.find((s) => s.date >= today) ?? null;
    const group_: StudyGroup = {
      id: group.id,
      name: group.name,
      subjectId: group.subjectId ?? "",
      about: group.about,
      weeklyMinutes: 0,
      members: [
        ...group.members.map((m) => ({
          id: m.userId === userId ? "me" : m.userId,
          name: m.userId === userId ? "Ti" : `${m.user.name}`.trim(),
          initials: `${m.user.name[0] ?? "?"}${m.user.surname[0] ?? ""}`.toUpperCase(),
          tone: m.user.profile?.avatarTone ?? 0,
          state: m.state as "meson" | "pushim" | "offline",
          role: (m.role === "owner" ? "owner" : "member") as "owner" | "member",
        })),
        {
          id: "ai",
          name: "Asistenti AI",
          initials: "AI",
          tone: 0,
          state: "meson" as const,
          role: "ai" as const,
        },
      ],
      nextSession: next
        ? { date: next.date, start: next.start, minutes: next.minutes, topic: next.topic }
        : null,
      messages: group.messages.map((m) => ({
        id: m.id,
        authorId: m.userId === userId ? "me" : m.isAI ? "ai" : (m.userId ?? "?"),
        authorName: m.authorName,
        text: m.text,
        at: hhmm(m.createdAt),
        isAI: m.isAI,
        kind: m.kind as "text" | "plan" | "quiz" | "system",
        quiz: m.payload ? safeParseQuiz(m.payload) : undefined,
      })),
      sharedNotes: group.sharedNotes,
      tasks: [],
    };
    return group_;
  });

  const pref = user.preference;

  return {
    profile: {
      name: user.name,
      surname: user.surname,
      level: mapLearner(user.profile?.learnerType ?? "universitet"),
      institution: user.profile?.institution ?? "",
      year: user.profile?.year ?? "",
      avatarTone: user.profile?.avatarTone ?? 0,
      onboarded: !!user.profile?.onboardedAt,
    },
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      short: s.short || s.name.slice(0, 3).toUpperCase(),
      tone: s.tone,
      teacher: s.teacher,
      room: s.room,
      difficulty: s.difficulty as 1 | 2 | 3 | 4 | 5,
      importance: s.importance as 1 | 2 | 3 | 4 | 5,
      targetGrade: s.targetGrade,
      currentGrade: s.currentGrade,
      credits: s.credits,
      topics: s.topics.map((t) => ({
        id: t.id,
        name: t.name,
        mastery: t.mastery as Mastery,
        minutes: t.minutes,
      })),
    })),
    classes: lectures.map((l) => ({
      id: l.id,
      subjectId: l.subjectId,
      day: l.day as DayIndex,
      start: l.start,
      end: l.end,
      kind: l.kind as "ligjerate",
      room: l.room,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      subjectId: s.subjectId,
      kind: s.kind as "mesim",
      title: s.title,
      objective: s.objective || undefined,
      date: s.date,
      start: s.start,
      minutes: s.minutes,
      status: s.status as "planned",
      why: s.why || undefined,
      rating: (s.rating ?? undefined) as 1 | 2 | 3 | 4 | undefined,
      understanding: (s.understanding ?? undefined) as 1 | 2 | 3 | 4 | 5 | undefined,
      linkedId: s.linkedId ?? undefined,
      groupId: s.groupId ?? undefined,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      subjectId: a.subjectId,
      title: a.title,
      detail: a.detail,
      due: a.due,
      progress: a.progress,
      estMinutes: a.estMinutes,
      done: a.done,
      steps: a.steps.map((st) => ({ id: st.id, label: st.label, done: st.done })),
    })),
    exams: exams.map((e) => ({
      id: e.id,
      subjectId: e.subjectId,
      title: e.title,
      kind: e.kind as "kolokvium",
      date: e.date,
      start: e.start,
      room: e.room,
      targetGrade: e.targetGrade,
      studiedMinutes: e.studiedMinutes,
      topicIds: e.topics.map((t) => t.topicId),
    })),
    grades: grades.map((g) => ({
      id: g.id,
      subjectId: g.subjectId,
      kind: g.kind as "kuiz",
      title: g.title,
      value: g.value,
      weight: g.weight,
      date: g.date,
    })),
    materials: materials.map((m) => ({
      id: m.id,
      subjectId: m.subjectId,
      title: m.title,
      kind: m.kind as "pdf",
      meta: m.meta,
      addedAt: iso(m.createdAt),
      summary: m.summary ?? undefined,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      subjectId: n.subjectId,
      title: n.title,
      body: n.body,
      updatedAt: iso(n.updatedAt),
      pinned: n.pinned,
    })),
    friends,
    groups,
    goals: goals.map((g) => g.key as GoalKey),
    availability: {
      windows: availability.map((a) => ({
        day: a.day as DayIndex,
        from: a.fromTime,
        to: a.toTime,
      })),
      sessionLength: pref?.sessionLength ?? 45,
      breakLength: pref?.breakLength ?? 15,
      maxMinutesPerDay: pref?.maxMinutesPerDay ?? 180,
      rhythm: (pref?.rhythm ?? "fleksibil") as "fleksibil",
      freeDays: parseDays(pref?.freeDays ?? "6"),
    },
    privacy: {
      shareStatus: user.settings?.shareStatus ?? true,
      shareSchedule: user.settings?.shareSchedule ?? true,
      shareProgress: user.settings?.shareProgress ?? true,
      shareGrades: user.settings?.shareGrades ?? false,
    },
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      at: hhmm(n.createdAt),
      tone: n.tone as "info",
      read: n.read,
    })),
    aiThread: (conversation?.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? ("ai" as const) : ("user" as const),
      text: m.content,
      at: hhmm(m.createdAt),
      ...(m.payload ? safeParsePayload(m.payload) : {}),
    })),
    streak: computeStreak(sessions, today),
    recall: {
      due: dueCount,
      total: cardCount,
      reviewedToday: reviewedTodayCount,
    },
    quizAccuracy: accuracyBySubject(quizAttempts),
  };
}

/**
 * Questions-correct over questions-asked, per subject.
 *
 * Weighting by question count rather than averaging per attempt stops a single
 * two-question quiz from carrying the same weight as a twenty-question one.
 * Subjects with no attempts are simply absent from the map.
 */
function accuracyBySubject(
  attempts: { subjectId: string | null; total: number; correct: number }[]
): Record<string, number> {
  const tally = new Map<string, { total: number; correct: number }>();

  for (const attempt of attempts) {
    if (!attempt.subjectId) continue;
    const row = tally.get(attempt.subjectId) ?? { total: 0, correct: 0 };
    row.total += attempt.total;
    row.correct += attempt.correct;
    tally.set(attempt.subjectId, row);
  }

  const out: Record<string, number> = {};
  for (const [subjectId, { total, correct }] of tally) {
    if (total > 0) out[subjectId] = correct / total;
  }
  return out;
}

/* ── helpers ─────────────────────────────────────────────── */

function hhmm(d: Date) {
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

function parseDays(csv: string): DayIndex[] {
  return csv
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) as DayIndex[];
}

function mapLearner(t: string): AppState["profile"]["level"] {
  switch (t) {
    case "shkolle":
      return "shkolle";
    case "bootcamp":
      return "kurs";
    case "vetemesim":
      return "vetemesim";
    default:
      return "fakultet";
  }
}

function safeParseQuiz(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed?.questions) ? parsed.questions : undefined;
  } catch {
    return undefined;
  }
}

function safeParsePayload(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    const out: Record<string, unknown> = {};
    if (Array.isArray(parsed?.questions)) out.quiz = parsed.questions;
    if (Array.isArray(parsed?.plan)) out.plan = parsed.plan;
    if (Array.isArray(parsed?.chips)) out.chips = parsed.chips;
    return out;
  } catch {
    return {};
  }
}

/** Consecutive days, counting back from today, with at least one done session. */
function computeStreak(
  sessions: { date: string; status: string }[],
  today: string
): number {
  const done = new Set(
    sessions.filter((s) => s.status === "done").map((s) => s.date)
  );
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);

  // Today not being studied yet shouldn't break a run that is still alive.
  if (!done.has(today)) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const key = iso(cursor);
    if (!done.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
