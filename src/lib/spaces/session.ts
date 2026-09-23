/**
 * The focus/break clock.
 *
 * The server stores when the current phase began and how long it is; the
 * countdown every browser shows is derived from that. No client is trusted to
 * keep time, and a student who reloads mid-round sees the same number as
 * everyone else rather than a timer that restarted.
 *
 * Pure functions of a stored row plus "now", so the whole cycle is testable
 * without waiting for real minutes to pass.
 */

export type SessionMode = "focus" | "break" | "ended";

/** The stored shape. Mirrors StudySpaceSession, minus the database concerns. */
export interface SessionState {
  mode: SessionMode;
  currentRound: number;
  totalRounds: number;
  studyMinutes: number;
  breakMinutes: number;
  /** Epoch ms when the current phase began, or null while paused. */
  phaseStartedAt: number | null;
  /** Seconds banked in this phase before the last pause. */
  phaseElapsed: number;
  paused: boolean;
}

export interface SessionView {
  mode: SessionMode;
  currentRound: number;
  totalRounds: number;
  paused: boolean;
  /** Seconds elapsed in the current phase. */
  elapsed: number;
  /** Seconds the current phase runs for. */
  duration: number;
  /** Seconds left, never negative. */
  remaining: number;
  /** 0..1 through the current phase. */
  progress: number;
  /** True once the phase has run out and the next one is due. */
  expired: boolean;
}

export function phaseDurationSeconds(state: SessionState): number {
  if (state.mode === "ended") return 0;
  const minutes =
    state.mode === "focus" ? state.studyMinutes : state.breakMinutes;
  return Math.max(1, Math.round(minutes * 60));
}

/** What the clock reads at `now`. */
export function viewSession(state: SessionState, now: number): SessionView {
  const duration = phaseDurationSeconds(state);

  const live =
    state.paused || state.phaseStartedAt === null
      ? 0
      : Math.max(0, Math.floor((now - state.phaseStartedAt) / 1000));

  const elapsed = state.mode === "ended" ? 0 : state.phaseElapsed + live;
  const remaining = Math.max(0, duration - elapsed);

  return {
    mode: state.mode,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    paused: state.paused,
    elapsed,
    duration,
    remaining,
    progress: duration > 0 ? Math.min(1, elapsed / duration) : 0,
    expired: state.mode !== "ended" && remaining === 0,
  };
}

/**
 * The phase that follows this one.
 *
 * The last round has no break: the session ends when the work does, rather
 * than making everyone sit through a break nobody is waiting for.
 */
export function advance(state: SessionState, now: number): SessionState {
  if (state.mode === "ended") return state;

  const fresh = (mode: SessionMode, round: number): SessionState => ({
    ...state,
    mode,
    currentRound: round,
    phaseStartedAt: mode === "ended" ? null : now,
    phaseElapsed: 0,
    paused: false,
  });

  if (state.mode === "focus") {
    const isLastRound = state.currentRound >= state.totalRounds;
    return isLastRound
      ? fresh("ended", state.currentRound)
      : fresh("break", state.currentRound);
  }

  // A break always leads into the next round of work.
  return fresh("focus", state.currentRound + 1);
}

/** Banks the time run so far and stops the clock. */
export function pause(state: SessionState, now: number): SessionState {
  if (state.paused || state.mode === "ended") return state;

  const live =
    state.phaseStartedAt === null
      ? 0
      : Math.max(0, Math.floor((now - state.phaseStartedAt) / 1000));

  return {
    ...state,
    paused: true,
    phaseElapsed: state.phaseElapsed + live,
    phaseStartedAt: null,
  };
}

export function resume(state: SessionState, now: number): SessionState {
  if (!state.paused || state.mode === "ended") return state;
  return { ...state, paused: false, phaseStartedAt: now };
}

/** Ends the session outright. */
export function end(state: SessionState): SessionState {
  return { ...state, mode: "ended", paused: false, phaseStartedAt: null, phaseElapsed: 0 };
}

/** Skips the rest of the current phase. */
export function skip(state: SessionState, now: number): SessionState {
  return advance(state, now);
}

export function startSession(
  config: { studyMinutes: number; breakMinutes: number; rounds: number },
  now: number
): SessionState {
  return {
    mode: "focus",
    currentRound: 1,
    totalRounds: Math.max(1, config.rounds),
    studyMinutes: Math.max(1, config.studyMinutes),
    breakMinutes: Math.max(0, config.breakMinutes),
    phaseStartedAt: now,
    phaseElapsed: 0,
    paused: false,
  };
}

/** "48:34", or "1:02:11" once a phase runs past an hour. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = `${m}`.padStart(2, "0");
  const ss = `${sec}`.padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const MODE_LABEL: Record<SessionMode, string> = {
  focus: "Fokus",
  break: "Pushim",
  ended: "Përfunduar",
};
