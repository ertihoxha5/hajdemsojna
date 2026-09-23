"use client";

import { Check, Trophy } from "lucide-react";
import { dur } from "@/lib/date";
import { Button, Card, Modal, cx } from "@/components/ui";

/**
 * What the session came to.
 *
 * Shown once the last round finishes. Deliberately not a leaderboard: the
 * list is ordered by focus time because that is the most natural order, but
 * nobody is ranked, nobody is marked worst, and the number that gets the
 * most space is the group's total rather than any individual's. A study
 * group is not a competition, and turning it into one is how people stop
 * turning up.
 */

export interface RecapMember {
  userId: string;
  name: string;
  focusSeconds: number;
  points: number;
  rounds: number;
  goal: string;
  goalDone: boolean;
  attendance: number;
}

export interface Recap {
  sessionId: string;
  spaceName: string;
  totalMinutes: number;
  roundsDone: number;
  roundsPlanned: number;
  collectiveSeconds: number;
  members: RecapMember[];
  summary: string | null;
}

export function SessionRecap({
  recap,
  meId,
  onClose,
}: {
  recap: Recap;
  meId: string;
  onClose: () => void;
}) {
  const me = recap.members.find((m) => m.userId === meId);
  const collectiveMinutes = Math.round(recap.collectiveSeconds / 60);

  return (
    <Modal open onClose={onClose} title="Sesioni përfundoi">
      <div className="flex flex-col gap-4">
        {/* Yours first: it is the number they came for. */}
        {me && (
          <Card className="text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fokusi yt
            </p>
            <p className="num mt-1 text-[32px] font-semibold leading-none text-ink">
              {dur(Math.round(me.focusSeconds / 60))}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {me.rounds} raund{me.rounds === 1 ? "" : "e"} · +{me.points} Focus
              Points
            </p>

            {me.goal && (
              <p
                className={cx(
                  "mt-2 flex items-center justify-center gap-1.5 text-[12.5px]",
                  me.goalDone ? "text-ok" : "text-muted"
                )}
              >
                {me.goalDone && <Check size={13} />}
                {me.goal}
              </p>
            )}
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Gjithsej" value={dur(recap.totalMinutes)} />
          <Stat
            label="Raunde"
            value={`${recap.roundsDone}/${recap.roundsPlanned}`}
          />
          <Stat label="Grupi" value={dur(collectiveMinutes)} />
        </div>

        {/* Not a ranking: no positions, no medals, no last place. */}
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            Së bashku
          </p>
          <ul className="flex flex-col gap-1.5">
            {recap.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {m.userId === meId ? "Ti" : m.name}
                </span>

                <div className="h-1 w-20 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.min(100, m.attendance)}%` }}
                  />
                </div>

                <span className="num w-14 shrink-0 text-right text-[12px] text-muted">
                  {dur(Math.round(m.focusSeconds / 60))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {recap.summary && (
          <div className="rounded-[10px] border border-ai/25 bg-ai-soft/40 p-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ai">
              Mso AI
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">
              {recap.summary}
            </p>
          </div>
        )}

        <p className="flex items-start gap-2 rounded-[10px] border border-ok/25 bg-ok-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ok">
          <Trophy size={14} className="mt-0.5 shrink-0" />
          Koha jote u ruajt te Progresi — sesionet në grup numërohen si çdo
          sesion tjetër.
        </p>

        <Button onClick={onClose}>Mbyll</Button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line px-2 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint">
        {label}
      </p>
      <p className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}
