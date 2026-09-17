import type {
  AIMessage,
  AppState,
  Assignment,
  ClassEntry,
  Exam,
  Grade,
  GroupMessage,
  Material,
  Mastery,
  Note,
  StudySession,
  Subject,
} from "./types";

/**
 * The action contract shared by the client reducer and the server.
 *
 * The browser applies an action optimistically and posts the same object to
 * /api/mutate, where it is re-applied against the database under the
 * authenticated user. Keeping one union means the two can't drift apart.
 */
export type Action =
  | { type: "replace"; state: AppState }
  | {
      type: "session/complete";
      id: string;
      rating?: 1 | 2 | 3 | 4;
      understanding?: 1 | 2 | 3 | 4 | 5;
    }
  | { type: "session/status"; id: string; status: StudySession["status"] }
  | { type: "session/move"; id: string; date: string; start: string }
  | { type: "session/add"; session: StudySession }
  | { type: "session/remove"; id: string }
  | { type: "plan/generate"; from: string }
  | { type: "plan/rebalance"; today: string }
  | { type: "assignment/add"; assignment: Assignment }
  | { type: "assignment/step"; id: string; stepId: string }
  | { type: "assignment/progress"; id: string; progress: number }
  | { type: "assignment/done"; id: string }
  | { type: "assignment/remove"; id: string }
  | { type: "exam/add"; exam: Exam }
  | { type: "exam/remove"; id: string }
  | { type: "subject/add"; subject: Subject }
  | { type: "subject/update"; id: string; patch: Partial<Subject> }
  | { type: "subject/remove"; id: string }
  | { type: "topic/mastery"; subjectId: string; topicId: string; mastery: Mastery }
  | { type: "topic/add"; subjectId: string; topicId: string; name: string }
  | { type: "class/add"; entry: ClassEntry }
  | { type: "class/move"; id: string; day: ClassEntry["day"]; start: string; end: string }
  | { type: "class/remove"; id: string }
  | { type: "grade/add"; grade: Grade }
  | { type: "grade/remove"; id: string }
  | { type: "note/save"; note: Note }
  | { type: "note/remove"; id: string }
  | { type: "material/add"; material: Material }
  | { type: "material/summarize"; id: string; summary: string }
  | { type: "material/remove"; id: string }
  | { type: "group/message"; groupId: string; message: GroupMessage }
  | { type: "group/task"; groupId: string; taskId: string }
  | { type: "group/notes"; groupId: string; notes: string }
  | { type: "group/vote"; groupId: string; option: number }
  | {
      type: "group/memberState";
      groupId: string;
      memberId: string;
      state: "meson" | "pushim" | "offline";
    }
  | { type: "ai/push"; message: AIMessage }
  | { type: "ai/clear" }
  | { type: "privacy/toggle"; key: keyof AppState["privacy"] }
  | { type: "availability/patch"; patch: Partial<AppState["availability"]> }
  | { type: "profile/patch"; patch: Partial<AppState["profile"]> }
  | { type: "goals/set"; goals: AppState["goals"] }
  | { type: "notification/read"; id: string };

/**
 * Actions that exist only in the browser — history replacement, the local AI
 * transcript buffer, and group state that arrives over the message stream.
 * These are never posted to /api/mutate.
 */
const LOCAL_ONLY = new Set<Action["type"]>([
  "replace",
  "ai/push",
  "ai/clear",
  "group/message",
  "group/task",
  "group/vote",
]);

export function isServerAction(action: Action): boolean {
  return !LOCAL_ONLY.has(action.type);
}
