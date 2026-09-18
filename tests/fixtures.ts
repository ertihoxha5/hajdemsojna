import type {
  AppState,
  Assignment,
  Exam,
  Grade,
  Subject,
  StudySession,
  Topic,
} from "@/lib/types.ts";

/**
 * Builders for planner and insight tests.
 *
 * Every field is defaulted so a test names only what it is actually about —
 * a test for exam urgency should not have to invent a room number.
 */

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function resetIds() {
  seq = 0;
}

export function topic(over: Partial<Topic> = {}): Topic {
  return { id: nextId("t"), name: "Temë", mastery: 0, minutes: 0, ...over };
}

export function subject(over: Partial<Subject> = {}): Subject {
  return {
    id: nextId("s"),
    name: "Lëndë",
    short: "LN",
    tone: 0,
    teacher: "",
    room: "",
    difficulty: 3,
    importance: 3,
    targetGrade: 9,
    currentGrade: 0,
    credits: 6,
    topics: [],
    ...over,
  };
}

export function exam(over: Partial<Exam> & { subjectId: string }): Exam {
  return {
    id: nextId("e"),
    title: "Provim",
    kind: "kolokvium",
    date: "2026-09-30",
    start: "09:00",
    room: "",
    targetGrade: 9,
    studiedMinutes: 0,
    topicIds: [],
    ...over,
  };
}

export function assignment(
  over: Partial<Assignment> & { subjectId: string }
): Assignment {
  return {
    id: nextId("a"),
    title: "Detyrë",
    detail: "",
    due: "2026-09-25",
    progress: 0,
    estMinutes: 120,
    done: false,
    steps: [],
    ...over,
  };
}

export function grade(over: Partial<Grade> & { subjectId: string }): Grade {
  return {
    id: nextId("g"),
    kind: "kuiz",
    title: "Kuiz",
    value: 8,
    weight: 0.2,
    date: "2026-09-10",
    ...over,
  };
}

export function session(over: Partial<StudySession> = {}): StudySession {
  return {
    id: nextId("ss"),
    subjectId: null,
    kind: "mesim",
    title: "Sesion",
    objective: "",
    date: "2026-09-17",
    start: "18:00",
    minutes: 45,
    status: "planned",
    why: "",
    source: "rule",
    ...over,
  } as StudySession;
}

export function state(over: Partial<AppState> = {}): AppState {
  return {
    profile: {
      name: "Test",
      surname: "Student",
      level: "fakultet",
      institution: "",
      year: "",
      avatarTone: 0,
      onboarded: true,
    },
    subjects: [],
    classes: [],
    sessions: [],
    assignments: [],
    exams: [],
    grades: [],
    materials: [],
    notes: [],
    friends: [],
    groups: [],
    goals: [],
    availability: {
      windows: [
        { day: 0, from: "17:00", to: "21:00" },
        { day: 1, from: "17:00", to: "21:00" },
        { day: 2, from: "17:00", to: "21:00" },
        { day: 3, from: "17:00", to: "21:00" },
        { day: 4, from: "17:00", to: "21:00" },
      ],
      sessionLength: 45,
      breakLength: 15,
      maxMinutesPerDay: 180,
      rhythm: "fleksibil",
      freeDays: [6],
    },
    privacy: {
      shareStatus: true,
      shareSchedule: true,
      shareProgress: true,
      shareGrades: false,
    },
    notifications: [],
    aiThread: [],
    streak: 0,
    ...over,
  } as AppState;
}
