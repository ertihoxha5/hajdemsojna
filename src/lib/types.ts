/** Core domain model for Hajde Msojna. */

export type ID = string;

/** 0 = E hënë … 6 = E diel */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type LevelKey = "shkolle" | "fakultet" | "kurs" | "vetemesim";

export type Mastery = 0 | 1 | 2 | 3; // nuk e di | pak | e kuptoj | e zotëroj

export type ClassKind = "ligjerate" | "ushtrime" | "lab" | "seminar";

export type SessionKind =
  | "mesim"
  | "perseritje"
  | "detyre"
  | "pushim"
  | "grup"
  | "provim-prep";

export type SessionStatus = "planned" | "done" | "missed" | "skipped";

export type GradeKind =
  | "kuiz"
  | "detyre"
  | "gjysmefinal"
  | "final"
  | "projekt"
  | "pjesemarrje";

export type MaterialKind = "pdf" | "ppt" | "link" | "foto" | "dok";

export interface Profile {
  name: string;
  surname: string;
  level: LevelKey;
  institution: string;
  year: string;
  avatarTone: number;
  onboarded: boolean;
}

export interface Topic {
  id: ID;
  name: string;
  mastery: Mastery;
  minutes: number;
}

export interface Subject {
  id: ID;
  name: string;
  short: string;
  tone: number; // index into the subject tone palette
  teacher: string;
  room: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  importance: 1 | 2 | 3 | 4 | 5;
  targetGrade: number;
  currentGrade: number;
  credits: number;
  topics: Topic[];
}

export interface ClassEntry {
  id: ID;
  subjectId: ID;
  day: DayIndex;
  start: string; // "HH:MM"
  end: string;
  kind: ClassKind;
  room: string;
}

export interface StudySession {
  id: ID;
  subjectId: ID | null;
  kind: SessionKind;
  title: string;
  objective?: string;
  date: string; // "YYYY-MM-DD"
  start: string; // "HH:MM"
  minutes: number;
  status: SessionStatus;
  /** Why the planner scheduled this — shown in the UI. */
  why?: string;
  rating?: 1 | 2 | 3 | 4; // vështirë … shumë mirë
  understanding?: 1 | 2 | 3 | 4 | 5;
  linkedId?: ID; // assignment or exam this session serves
  groupId?: ID;
}

export interface Assignment {
  id: ID;
  subjectId: ID;
  title: string;
  detail: string;
  due: string; // "YYYY-MM-DD"
  progress: number; // 0..100
  estMinutes: number;
  done: boolean;
  steps: { id: ID; label: string; done: boolean }[];
}

export interface Exam {
  id: ID;
  subjectId: ID;
  title: string;
  kind: "kolokvium" | "final" | "provim";
  date: string;
  start: string;
  room: string;
  targetGrade: number;
  studiedMinutes: number;
  topicIds: ID[];
}

export interface Grade {
  id: ID;
  subjectId: ID;
  kind: GradeKind;
  title: string;
  value: number; // 1..10
  weight: number; // 0..1 share of final grade
  date: string;
}

export interface Material {
  id: ID;
  subjectId: ID | null;
  title: string;
  kind: MaterialKind;
  meta: string;
  addedAt: string;
  summary?: string;
}

export interface Note {
  id: ID;
  subjectId: ID | null;
  title: string;
  body: string;
  updatedAt: string;
  pinned?: boolean;
}

export type FriendStatus = "meson" | "pushim" | "lire" | "offline";

export interface Friend {
  id: ID;
  name: string;
  initials: string;
  tone: number;
  status: FriendStatus;
  statusSubject?: string;
  faculty: string;
  mutualSubjects: string[];
  streak: number;
  weeklyMinutes: number;
}

export interface GroupMessage {
  id: ID;
  authorId: ID;
  authorName: string;
  text: string;
  at: string; // "HH:MM"
  isAI?: boolean;
  kind?: "text" | "quiz" | "plan" | "system";
  quiz?: QuizQuestion[];
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  hint: string;
}

export interface GroupMember {
  id: ID;
  name: string;
  initials: string;
  tone: number;
  state: "meson" | "pushim" | "offline";
  role?: "owner" | "member" | "ai";
}

export interface StudyGroup {
  id: ID;
  name: string;
  subjectId: ID;
  about: string;
  members: GroupMember[];
  nextSession: { date: string; start: string; minutes: number; topic: string } | null;
  messages: GroupMessage[];
  sharedNotes: string;
  tasks: { id: ID; label: string; done: boolean; by: string }[];
  poll?: { question: string; options: { label: string; votes: number }[] };
  weeklyMinutes: number;
}

export interface Availability {
  /** Per weekday list of windows the student can study. */
  windows: { day: DayIndex; from: string; to: string }[];
  sessionLength: number; // minutes
  breakLength: number;
  maxMinutesPerDay: number;
  rhythm: "mengjes" | "mbremje" | "fleksibil";
  freeDays: DayIndex[];
}

export type GoalKey =
  | "kaloj-provimet"
  | "permiresoj-notat"
  | "mesoj-rregullisht"
  | "matura"
  | "afati"
  | "detyrat-me-kohe";

export interface Notification {
  id: ID;
  title: string;
  body: string;
  at: string;
  tone: "info" | "ok" | "warn" | "ai";
  read: boolean;
}

export interface AIMessage {
  id: ID;
  role: "user" | "ai";
  text: string;
  at: string;
  chips?: string[];
  quiz?: QuizQuestion[];
  plan?: { time: string; label: string; minutes: number }[];
}

export interface Privacy {
  shareStatus: boolean;
  shareGrades: boolean;
  shareSchedule: boolean;
  shareProgress: boolean;
}

export interface AppState {
  profile: Profile;
  subjects: Subject[];
  classes: ClassEntry[];
  sessions: StudySession[];
  assignments: Assignment[];
  exams: Exam[];
  grades: Grade[];
  materials: Material[];
  notes: Note[];
  friends: Friend[];
  groups: StudyGroup[];
  goals: GoalKey[];
  availability: Availability;
  privacy: Privacy;
  notifications: Notification[];
  aiThread: AIMessage[];
  streak: number;
}
