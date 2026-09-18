/**
 * Splits a study session into work and break phases.
 *
 * The student already told the app how long they can concentrate and how long
 * a break should be, in Cilësimet → Ritmi. Until now focus mode ignored both
 * and ran one long countdown, which is exactly the thing the preference exists
 * to prevent.
 *
 * Pure and synchronous: given the same session length it always produces the
 * same phases, so the timer can be rebuilt from scratch after a reload.
 */

export interface Phase {
  kind: "punë" | "pushim";
  /** Seconds this phase runs for. */
  seconds: number;
  /** 1-based index among work phases; 0 for breaks. */
  round: number;
}

export interface PomodoroPlan {
  phases: Phase[];
  /** Work phases only — what the session is actually worth. */
  workSeconds: number;
  totalSeconds: number;
  rounds: number;
}

/**
 * Builds the phase list for one session.
 *
 * A trailing break is never added: the session ends when the work ends, so the
 * review prompt appears the moment the last minute of study is done rather
 * than after a break nobody is waiting through.
 *
 * A session shorter than one work block is left whole — chopping a 20-minute
 * session into pieces helps nobody.
 */
export function buildPomodoro(
  sessionMinutes: number,
  workMinutes: number,
  breakMinutes: number
): PomodoroPlan {
  const total = Math.max(1, Math.round(sessionMinutes));
  const work = Math.max(1, Math.round(workMinutes));
  const rest = Math.max(0, Math.round(breakMinutes));

  if (total <= work || rest === 0) {
    return {
      phases: [{ kind: "punë", seconds: total * 60, round: 1 }],
      workSeconds: total * 60,
      totalSeconds: total * 60,
      rounds: 1,
    };
  }

  const phases: Phase[] = [];
  let remaining = total;
  let round = 0;

  while (remaining > 0) {
    const block = Math.min(work, remaining);
    round += 1;
    phases.push({ kind: "punë", seconds: block * 60, round });
    remaining -= block;

    // Only insert a break if there is real work left after it.
    if (remaining > 0) {
      phases.push({ kind: "pushim", seconds: rest * 60, round: 0 });
    }
  }

  const workSeconds = phases
    .filter((p) => p.kind === "punë")
    .reduce((s, p) => s + p.seconds, 0);

  return {
    phases,
    workSeconds,
    totalSeconds: phases.reduce((s, p) => s + p.seconds, 0),
    rounds: round,
  };
}

/** "Punë 2/4" or "Pushim" — the label above the clock. */
export function phaseLabel(phase: Phase, rounds: number): string {
  return phase.kind === "pushim" ? "Pushim" : `Punë ${phase.round}/${rounds}`;
}
