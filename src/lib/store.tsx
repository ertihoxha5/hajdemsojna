"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { AppState, Mastery } from "./types";
import type { Action } from "./store-actions";
import { isServerAction } from "./store-actions";
import { timeOf } from "./date";

export type { Action };

/* ============================================================
   Reducer
   ============================================================ */

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "replace":
      return action.state;

    case "session/complete": {
      const session = state.sessions.find((s) => s.id === action.id);
      let subjects = state.subjects;
      // Understanding the material well nudges the topic's mastery forward.
      if (session?.subjectId && (action.understanding ?? 0) >= 4) {
        subjects = state.subjects.map((s) => {
          if (s.id !== session.subjectId) return s;
          return {
            ...s,
            topics: s.topics.map((t) =>
              t.name === session.title && t.mastery < 3
                ? { ...t, mastery: (t.mastery + 1) as Mastery, minutes: t.minutes + session.minutes }
                : t.name === session.title
                  ? { ...t, minutes: t.minutes + session.minutes }
                  : t
            ),
          };
        });
      } else if (session?.subjectId) {
        subjects = state.subjects.map((s) =>
          s.id === session.subjectId
            ? {
                ...s,
                topics: s.topics.map((t) =>
                  t.name === session.title ? { ...t, minutes: t.minutes + session.minutes } : t
                ),
              }
            : s
        );
      }

      const exams = session
        ? state.exams.map((e) =>
            e.subjectId === session.subjectId
              ? { ...e, studiedMinutes: e.studiedMinutes + session.minutes }
              : e
          )
        : state.exams;

      return {
        ...state,
        subjects,
        exams,
        sessions: state.sessions.map((s) =>
          s.id === action.id
            ? { ...s, status: "done", rating: action.rating, understanding: action.understanding }
            : s
        ),
      };
    }

    case "session/status":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.id ? { ...s, status: action.status } : s
        ),
      };

    case "session/move":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.id
            ? { ...s, date: action.date, start: action.start, status: "planned" }
            : s
        ),
      };

    case "session/add":
      return { ...state, sessions: [...state.sessions, action.session] };

    case "session/remove":
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.id) };

    // Planning runs on the server (it may call the model and must be
    // validated before it is stored). The provider refetches afterwards.
    case "plan/generate":
    case "plan/rebalance":
      return state;

    case "assignment/add":
      return { ...state, assignments: [...state.assignments, action.assignment] };

    case "assignment/step": {
      const assignments = state.assignments.map((a) => {
        if (a.id !== action.id) return a;
        const steps = a.steps.map((s) =>
          s.id === action.stepId ? { ...s, done: !s.done } : s
        );
        const progress = steps.length
          ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100)
          : a.progress;
        return { ...a, steps, progress, done: progress === 100 };
      });
      return { ...state, assignments };
    }

    case "assignment/progress":
      return {
        ...state,
        assignments: state.assignments.map((a) =>
          a.id === action.id
            ? { ...a, progress: action.progress, done: action.progress === 100 }
            : a
        ),
      };

    case "assignment/done":
      return {
        ...state,
        assignments: state.assignments.map((a) =>
          a.id === action.id ? { ...a, done: true, progress: 100 } : a
        ),
      };

    case "exam/add":
      return { ...state, exams: [...state.exams, action.exam] };

    case "exam/remove":
      return { ...state, exams: state.exams.filter((e) => e.id !== action.id) };

    case "assignment/remove":
      return {
        ...state,
        assignments: state.assignments.filter((a) => a.id !== action.id),
      };

    case "material/remove":
      return {
        ...state,
        materials: state.materials.filter((m) => m.id !== action.id),
      };

    case "subject/add":
      return { ...state, subjects: [...state.subjects, action.subject] };

    case "subject/update":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s
        ),
      };

    case "subject/remove":
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.id),
        classes: state.classes.filter((c) => c.subjectId !== action.id),
      };

    case "topic/mastery":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                topics: s.topics.map((t) =>
                  t.id === action.topicId ? { ...t, mastery: action.mastery } : t
                ),
              }
            : s
        ),
      };

    case "topic/add":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                topics: [
                  ...s.topics,
                  { id: action.topicId, name: action.name, mastery: 0, minutes: 0 },
                ],
              }
            : s
        ),
      };

    case "class/add":
      return { ...state, classes: [...state.classes, action.entry] };

    case "class/move":
      return {
        ...state,
        classes: state.classes.map((c) =>
          c.id === action.id
            ? { ...c, day: action.day, start: action.start, end: action.end }
            : c
        ),
      };

    case "class/remove":
      return { ...state, classes: state.classes.filter((c) => c.id !== action.id) };

    case "grade/add":
      return { ...state, grades: [...state.grades, action.grade] };

    case "grade/remove":
      return { ...state, grades: state.grades.filter((g) => g.id !== action.id) };

    case "note/save": {
      const exists = state.notes.some((n) => n.id === action.note.id);
      return {
        ...state,
        notes: exists
          ? state.notes.map((n) => (n.id === action.note.id ? action.note : n))
          : [action.note, ...state.notes],
      };
    }

    case "note/remove":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };

    case "material/add":
      return { ...state, materials: [action.material, ...state.materials] };

    case "material/summarize":
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.id ? { ...m, summary: action.summary } : m
        ),
      };

    case "group/message":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, messages: [...g.messages, action.message] } : g
        ),
      };

    case "group/task":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                tasks: g.tasks.map((t) =>
                  t.id === action.taskId ? { ...t, done: !t.done } : t
                ),
              }
            : g
        ),
      };

    case "group/notes":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, sharedNotes: action.notes } : g
        ),
      };

    case "group/vote":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId && g.poll
            ? {
                ...g,
                poll: {
                  ...g.poll,
                  options: g.poll.options.map((o, i) =>
                    i === action.option ? { ...o, votes: o.votes + 1 } : o
                  ),
                },
              }
            : g
        ),
      };

    case "group/memberState":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                members: g.members.map((m) =>
                  m.id === action.memberId ? { ...m, state: action.state } : m
                ),
              }
            : g
        ),
      };

    case "ai/push":
      return { ...state, aiThread: [...state.aiThread, action.message] };

    case "ai/clear":
      return { ...state, aiThread: [] };

    case "privacy/toggle":
      return {
        ...state,
        privacy: { ...state.privacy, [action.key]: !state.privacy[action.key] },
      };

    case "availability/patch":
      return { ...state, availability: { ...state.availability, ...action.patch } };

    case "profile/patch":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "goals/set":
      return { ...state, goals: action.goals };

    case "notification/read":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      };

    default:
      return state;
  }
}

/* ============================================================
   Provider
   ============================================================ */

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  today: string;
  now: string;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** Re-reads the authoritative state from the server. */
  refresh: () => Promise<void>;
  /** True while a write is in flight. */
  saving: boolean;
  /** Set when the last write failed; the UI surfaces this. */
  syncError: string | null;
}

const StoreCtx = createContext<Ctx | null>(null);

function clockNow(): string {
  const d = new Date();
  return timeOf(d.getHours() * 60 + d.getMinutes());
}

function initialTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("hm-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Holds the signed-in student's data.
 *
 * The server renders the initial state, so there is no loading flash and no
 * demo data. Each dispatch updates the reducer immediately and posts the same
 * action to /api/mutate, which re-applies it against the database under the
 * authenticated user. A failed write surfaces an error and refetches, so the
 * screen can never quietly drift from what was actually saved.
 */
export function StoreProvider({
  initialState,
  today,
  children,
}: {
  initialState: AppState;
  today: string;
  children: React.ReactNode;
}) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? "" : clockNow()
  );
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : initialTheme()
  );
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Writes are serialised so two quick edits can't land out of order.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { state: AppState };
      rawDispatch({ type: "replace", state: data.state });
    } catch {
      /* offline — keep what we have */
    }
  }, []);

  const dispatch = useCallback<React.Dispatch<Action>>(
    (action) => {
      rawDispatch(action);
      if (!isServerAction(action)) return;

      pending.current += 1;
      setSaving(true);
      queue.current = queue.current.then(async () => {
        try {
          const res = await fetch("/api/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, today }),
          });
          if (!res.ok) throw new Error(String(res.status));
          setSyncError(null);
          // Planning rewrites rows server-side, so pull the result back.
          if (action.type === "plan/generate" || action.type === "plan/rebalance") {
            await refresh();
          }
        } catch {
          setSyncError("Ndryshimi nuk u ruajt. Kontrollo lidhjen.");
          await refresh();
        } finally {
          pending.current -= 1;
          if (pending.current === 0) setSaving(false);
        }
      });
    },
    [today, refresh]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(clockNow()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("hm-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  const value = useMemo<Ctx>(
    () => ({ state, dispatch, today, now, theme, toggleTheme, refresh, saving, syncError }),
    [state, dispatch, today, now, theme, toggleTheme, refresh, saving, syncError]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-base font-semibold text-white">
          H
        </div>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-line">
          <div className="generating h-full w-full" />
        </div>
      </div>
    </div>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore duhet përdorur brenda StoreProvider");
  return ctx;
}
