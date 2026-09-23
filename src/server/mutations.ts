import "server-only";
import { db } from "@/lib/db";
import type { Action } from "@/lib/store-actions";
import { loadAppState } from "./state";
import { generatePlan, rebalance } from "@/lib/planner";

/**
 * Applies a client action to the database.
 *
 * Every write is filtered by userId, so a forged id in the request body simply
 * matches nothing rather than touching another student's row. The client's
 * reducer runs the same action optimistically; this is the authoritative copy.
 */
export async function applyAction(
  userId: string,
  action: Action,
  today: string
): Promise<void> {
  switch (action.type) {
    /* ── Study sessions ───────────────────────────────── */

    case "session/complete": {
      const session = await db.studySession.findFirst({
        where: { id: action.id, userId },
      });
      if (!session) return;

      await db.studySession.update({
        where: { id: session.id },
        data: {
          status: "done",
          rating: action.rating ?? null,
          understanding: action.understanding ?? null,
        },
      });

      if (session.subjectId) {
        // Time spent counts toward the topic and toward exam readiness.
        const topic = await db.topic.findFirst({
          where: { subjectId: session.subjectId, name: session.title },
        });
        if (topic) {
          const understood = (action.understanding ?? 0) >= 4;
          await db.topic.update({
            where: { id: topic.id },
            data: {
              minutes: { increment: session.minutes },
              mastery: understood ? Math.min(3, topic.mastery + 1) : topic.mastery,
            },
          });
        }
        await db.exam.updateMany({
          where: { userId, subjectId: session.subjectId, date: { gte: today } },
          data: { studiedMinutes: { increment: session.minutes } },
        });
      }
      return;
    }

    case "session/status":
      await db.studySession.updateMany({
        where: { id: action.id, userId },
        data: { status: action.status },
      });
      return;

    case "session/move":
      await db.studySession.updateMany({
        where: { id: action.id, userId },
        data: { date: action.date, start: action.start, status: "planned" },
      });
      return;

    case "session/add": {
      const s = action.session;
      // Only accept a subject the user actually owns.
      const subjectId = s.subjectId
        ? (await db.subject.findFirst({ where: { id: s.subjectId, userId } }))?.id ?? null
        : null;
      await db.studySession.create({
        data: {
          id: s.id,
          userId,
          subjectId,
          kind: s.kind,
          title: s.title,
          objective: s.objective ?? "",
          date: s.date,
          start: s.start,
          minutes: s.minutes,
          status: s.status,
          why: s.why ?? "",
          linkedId: s.linkedId ?? null,
          source: "rule",
        },
      });
      return;
    }

    case "session/remove":
      await db.studySession.deleteMany({ where: { id: action.id, userId } });
      return;

    /* ── Planning ─────────────────────────────────────── */

    case "plan/generate": {
      const state = await loadAppState(userId, today);
      const fresh = generatePlan(state, action.from, { days: 7 });

      await db.$transaction([
        // Replace only the still-open future; history is never rewritten.
        db.studySession.deleteMany({
          where: { userId, date: { gte: action.from }, status: "planned" },
        }),
        db.studySession.createMany({
          data: fresh.map((s) => ({
            id: s.id,
            userId,
            subjectId: s.subjectId,
            kind: s.kind,
            title: s.title,
            objective: s.objective ?? "",
            date: s.date,
            start: s.start,
            minutes: s.minutes,
            status: "planned",
            why: s.why ?? "",
            linkedId: s.linkedId ?? null,
            source: "rule",
          })),
        }),
      ]);
      return;
    }

    case "plan/rebalance": {
      const state = await loadAppState(userId, today);
      const moved = rebalance(state, today);
      const changed = moved.filter((s) => {
        const before = state.sessions.find((x) => x.id === s.id);
        return before && (before.date !== s.date || before.start !== s.start);
      });
      await db.$transaction(
        changed.map((s) =>
          db.studySession.updateMany({
            where: { id: s.id, userId },
            data: { date: s.date, start: s.start, status: "planned", why: s.why ?? "" },
          })
        )
      );
      return;
    }

    /* ── Assignments ──────────────────────────────────── */

    case "assignment/add": {
      const a = action.assignment;
      const subject = await db.subject.findFirst({ where: { id: a.subjectId, userId } });
      if (!subject) return;
      await db.assignment.create({
        data: {
          id: a.id,
          userId,
          subjectId: subject.id,
          title: a.title,
          detail: a.detail,
          due: a.due,
          progress: a.progress,
          estMinutes: a.estMinutes,
          done: a.done,
          steps: {
            create: a.steps.map((s, i) => ({
              id: s.id,
              label: s.label,
              done: s.done,
              position: i,
            })),
          },
        },
      });
      return;
    }

    case "assignment/step": {
      const assignment = await db.assignment.findFirst({
        where: { id: action.id, userId },
        include: { steps: true },
      });
      if (!assignment) return;

      const steps = assignment.steps.map((s) =>
        s.id === action.stepId ? { ...s, done: !s.done } : s
      );
      const progress = steps.length
        ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100)
        : assignment.progress;

      await db.$transaction([
        db.assignmentStep.updateMany({
          where: { id: action.stepId, assignmentId: assignment.id },
          data: { done: !assignment.steps.find((s) => s.id === action.stepId)?.done },
        }),
        db.assignment.update({
          where: { id: assignment.id },
          data: { progress, done: progress === 100 },
        }),
      ]);
      return;
    }

    case "assignment/progress":
      await db.assignment.updateMany({
        where: { id: action.id, userId },
        data: { progress: action.progress, done: action.progress === 100 },
      });
      return;

    case "assignment/done":
      await db.assignment.updateMany({
        where: { id: action.id, userId },
        data: { done: true, progress: 100 },
      });
      return;

    case "assignment/remove":
      await db.assignment.deleteMany({ where: { id: action.id, userId } });
      return;

    /* ── Exams ────────────────────────────────────────── */

    case "exam/add": {
      const e = action.exam;
      const subject = await db.subject.findFirst({ where: { id: e.subjectId, userId } });
      if (!subject) return;
      const ownTopics = await db.topic.findMany({
        where: { subjectId: subject.id, id: { in: e.topicIds } },
        select: { id: true },
      });
      await db.exam.create({
        data: {
          id: e.id,
          userId,
          subjectId: subject.id,
          title: e.title,
          kind: e.kind,
          date: e.date,
          start: e.start,
          room: e.room,
          targetGrade: e.targetGrade,
          studiedMinutes: e.studiedMinutes,
          topics: { create: ownTopics.map((t) => ({ topicId: t.id })) },
        },
      });
      return;
    }

    case "exam/remove":
      await db.exam.deleteMany({ where: { id: action.id, userId } });
      return;

    /* ── Subjects & topics ────────────────────────────── */

    case "subject/add": {
      const s = action.subject;
      await db.subject.create({
        data: {
          id: s.id,
          userId,
          name: s.name,
          short: s.short,
          tone: s.tone,
          teacher: s.teacher,
          room: s.room,
          difficulty: s.difficulty,
          importance: s.importance,
          targetGrade: s.targetGrade,
          currentGrade: s.currentGrade,
          credits: s.credits,
          topics: {
            create: s.topics.map((t, i) => ({
              id: t.id,
              name: t.name,
              mastery: t.mastery,
              minutes: t.minutes,
              position: i,
            })),
          },
        },
      });
      return;
    }

    case "subject/update": {
      const { topics: _topics, id: _id, ...rest } = action.patch;
      void _topics;
      void _id;
      await db.subject.updateMany({ where: { id: action.id, userId }, data: rest });
      return;
    }

    case "subject/remove":
      await db.subject.deleteMany({ where: { id: action.id, userId } });
      return;

    case "topic/mastery": {
      const owned = await db.subject.findFirst({
        where: { id: action.subjectId, userId },
        select: { id: true },
      });
      if (!owned) return;
      await db.topic.updateMany({
        where: { id: action.topicId, subjectId: owned.id },
        data: { mastery: action.mastery },
      });
      return;
    }

    case "topic/add": {
      const owned = await db.subject.findFirst({
        where: { id: action.subjectId, userId },
        select: { id: true, _count: { select: { topics: true } } },
      });
      if (!owned) return;
      await db.topic.create({
        data: {
          id: action.topicId,
          subjectId: owned.id,
          name: action.name,
          position: owned._count.topics,
        },
      });
      return;
    }

    /* ── Timetable ────────────────────────────────────── */

    case "class/add": {
      const e = action.entry;
      const subject = await db.subject.findFirst({ where: { id: e.subjectId, userId } });
      if (!subject) return;
      await db.lecture.create({
        data: {
          id: e.id,
          userId,
          subjectId: subject.id,
          day: e.day,
          start: e.start,
          end: e.end,
          kind: e.kind,
          room: e.room,
        },
      });
      return;
    }

    case "class/move":
      await db.lecture.updateMany({
        where: { id: action.id, userId },
        data: { day: action.day, start: action.start, end: action.end },
      });
      return;

    case "class/remove":
      await db.lecture.deleteMany({ where: { id: action.id, userId } });
      return;

    /* ── Grades ───────────────────────────────────────── */

    case "grade/add": {
      const g = action.grade;
      const subject = await db.subject.findFirst({ where: { id: g.subjectId, userId } });
      if (!subject) return;
      await db.grade.create({
        data: {
          id: g.id,
          userId,
          subjectId: subject.id,
          kind: g.kind,
          title: g.title,
          value: g.value,
          weight: g.weight,
          date: g.date,
        },
      });
      await recomputeCurrentGrade(userId, subject.id);
      return;
    }

    case "grade/remove": {
      const grade = await db.grade.findFirst({ where: { id: action.id, userId } });
      if (!grade) return;
      await db.grade.delete({ where: { id: grade.id } });
      await recomputeCurrentGrade(userId, grade.subjectId);
      return;
    }

    /* ── Notes & materials ────────────────────────────── */

    case "note/save": {
      const n = action.note;
      const subjectId = n.subjectId
        ? (await db.subject.findFirst({ where: { id: n.subjectId, userId } }))?.id ?? null
        : null;
      const existing = await db.note.findFirst({ where: { id: n.id, userId } });
      if (existing) {
        await db.note.update({
          where: { id: existing.id },
          data: { title: n.title, body: n.body, subjectId, pinned: n.pinned ?? false },
        });
      } else {
        await db.note.create({
          data: {
            id: n.id,
            userId,
            subjectId,
            title: n.title,
            body: n.body,
            pinned: n.pinned ?? false,
          },
        });
      }
      return;
    }

    case "note/remove":
      await db.note.deleteMany({ where: { id: action.id, userId } });
      return;

    case "material/add": {
      const m = action.material;
      const subjectId = m.subjectId
        ? (await db.subject.findFirst({ where: { id: m.subjectId, userId } }))?.id ?? null
        : null;
      await db.material.create({
        data: {
          id: m.id,
          userId,
          subjectId,
          title: m.title,
          kind: m.kind,
          meta: m.meta,
        },
      });
      return;
    }

    case "material/summarize":
      await db.material.updateMany({
        where: { id: action.id, userId },
        data: { summary: action.summary },
      });
      return;

    case "material/remove":
      await db.material.deleteMany({ where: { id: action.id, userId } });
      return;

    /* ── Groups ───────────────────────────────────────── */

    case "group/notes": {
      const member = await db.studySpaceMember.findFirst({
        where: { groupId: action.groupId, userId },
      });
      if (!member) return;
      await db.studySpace.update({
        where: { id: action.groupId },
        data: { sharedNotes: action.notes },
      });
      return;
    }

    case "group/memberState": {
      await db.studySpaceMember.updateMany({
        where: { groupId: action.groupId, userId },
        data: { state: action.state, lastSeen: new Date() },
      });
      return;
    }

    /* ── Preferences & profile ────────────────────────── */

    case "privacy/toggle": {
      const settings = await db.userSettings.findUnique({ where: { userId } });
      if (!settings) return;
      await db.userSettings.update({
        where: { userId },
        data: { [action.key]: !settings[action.key] },
      });
      return;
    }

    case "availability/patch": {
      const p = action.patch;
      if (p.windows) {
        await db.$transaction([
          db.availability.deleteMany({ where: { userId } }),
          db.availability.createMany({
            data: p.windows.map((w) => ({
              userId,
              day: w.day,
              fromTime: w.from,
              toTime: w.to,
            })),
          }),
        ]);
      }
      const prefData: Record<string, unknown> = {};
      if (p.sessionLength != null) prefData.sessionLength = p.sessionLength;
      if (p.breakLength != null) prefData.breakLength = p.breakLength;
      if (p.maxMinutesPerDay != null) prefData.maxMinutesPerDay = p.maxMinutesPerDay;
      if (p.rhythm) prefData.rhythm = p.rhythm;
      if (p.freeDays) prefData.freeDays = p.freeDays.join(",");
      if (Object.keys(prefData).length) {
        await db.studyPreference.upsert({
          where: { userId },
          create: { userId, ...prefData },
          update: prefData,
        });
      }
      return;
    }

    case "profile/patch": {
      const p = action.patch;
      if (p.name != null || p.surname != null) {
        await db.user.update({
          where: { id: userId },
          data: {
            ...(p.name != null ? { name: p.name } : {}),
            ...(p.surname != null ? { surname: p.surname } : {}),
          },
        });
      }
      const profileData: Record<string, unknown> = {};
      if (p.institution != null) profileData.institution = p.institution;
      if (p.year != null) profileData.year = p.year;
      if (p.avatarTone != null) profileData.avatarTone = p.avatarTone;
      if (p.level != null) profileData.learnerType = reverseLearner(p.level);
      if (Object.keys(profileData).length) {
        await db.userProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
      }
      return;
    }

    case "goals/set":
      await db.$transaction([
        db.studyGoal.deleteMany({ where: { userId } }),
        db.studyGoal.createMany({
          data: action.goals.map((key) => ({ userId, key })),
        }),
      ]);
      return;

    case "notification/read":
      await db.notification.updateMany({
        where: { id: action.id, userId },
        data: { read: true },
      });
      return;

    /* Actions handled entirely by dedicated endpoints or purely local UI. */
    case "replace":
    case "ai/push":
    case "ai/clear":
    case "group/message":
    case "group/task":
    case "group/vote":
      return;
  }
}

/** Keeps Subject.currentGrade in step with the weighted average of its grades. */
async function recomputeCurrentGrade(userId: string, subjectId: string) {
  const grades = await db.grade.findMany({ where: { userId, subjectId } });
  if (!grades.length) {
    await db.subject.updateMany({ where: { id: subjectId, userId }, data: { currentGrade: 0 } });
    return;
  }
  const weight = grades.reduce((s, g) => s + g.weight, 0) || 1;
  const earned = grades.reduce((s, g) => s + g.value * g.weight, 0);
  await db.subject.updateMany({
    where: { id: subjectId, userId },
    data: { currentGrade: Math.round((earned / weight) * 10) / 10 },
  });
}

function reverseLearner(level: string): string {
  switch (level) {
    case "shkolle":
      return "shkolle";
    case "kurs":
      return "bootcamp";
    case "vetemesim":
      return "vetemesim";
    default:
      return "universitet";
  }
}
