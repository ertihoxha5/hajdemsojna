"use client";

import Link from "next/link";
import { Flame, Target, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { dur, weekStart } from "@/lib/date";
import { currentGrade, minutesStudied, subjectProgress, weekStats } from "@/lib/planner";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Stat,
  SubjectDot,
} from "@/components/ui";
import type { GoalKey, LevelKey } from "@/lib/types";

const LEVELS: { key: LevelKey; label: string }[] = [
  { key: "shkolle", label: "Shkollë e mesme" },
  { key: "fakultet", label: "Fakultet / Universitet" },
  { key: "kurs", label: "Kurs / Bootcamp" },
  { key: "vetemesim", label: "Vetë-mësim" },
];

export const GOALS: { key: GoalKey; label: string }[] = [
  { key: "kaloj-provimet", label: "Kaloj provimet" },
  { key: "permiresoj-notat", label: "Përmirësoj notat" },
  { key: "mesoj-rregullisht", label: "Mësoj rregullisht" },
  { key: "matura", label: "Përgatitem për maturë" },
  { key: "afati", label: "Përgatitem për afatin e provimeve" },
  { key: "detyrat-me-kohe", label: "Përfundoj detyrat me kohë" },
];

export default function ProfilePage() {
  const { state, dispatch, today } = useStore();
  const ws = weekStats(state, weekStart(today));
  const totalMinutes = state.subjects.reduce((s, x) => s + minutesStudied(state, x.id), 0);
  const doneSessions = state.sessions.filter((s) => s.status === "done").length;

  return (
    <div>
      <PageHeader title="Profili" question="Kush jam dhe çfarë synoj?" />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar
                initials={state.profile.name[0] + state.profile.surname[0]}
                toneIndex={state.profile.avatarTone}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
                  {state.profile.name} {state.profile.surname}
                </h2>
                <p className="mt-0.5 text-[13.5px] text-muted">{state.profile.institution}</p>
                <p className="mt-0.5 text-[12.5px] text-faint">
                  {LEVELS.find((l) => l.key === state.profile.level)?.label} · {state.profile.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="warn">
                  <Flame size={11} />
                  {state.streak} ditë
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              <Stat label="Gjithsej" value={dur(totalMinutes)} sub="kohë mësimi" />
              <Stat label="Sesione" value={doneSessions} sub="të përfunduara" />
              <Stat label="Kjo javë" value={ws.label} sub={`${ws.consistency}% konsistencë`} />
              <Stat label="Lëndë" value={state.subjects.length} sub={`${state.subjects.reduce((s, x) => s + x.credits, 0)} ECTS`} />
            </div>
          </Card>

          <Card>
            <h3 className="text-[15px] font-semibold text-ink">Të dhënat</h3>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Field label="Emri">
                <Input
                  value={state.profile.name}
                  onChange={(e) => dispatch({ type: "profile/patch", patch: { name: e.target.value } })}
                />
              </Field>
              <Field label="Mbiemri">
                <Input
                  value={state.profile.surname}
                  onChange={(e) =>
                    dispatch({ type: "profile/patch", patch: { surname: e.target.value } })
                  }
                />
              </Field>
              <Field label="Ku mëson">
                <Select
                  value={state.profile.level}
                  onChange={(e) =>
                    dispatch({ type: "profile/patch", patch: { level: e.target.value as LevelKey } })
                  }
                >
                  {LEVELS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Viti">
                <Input
                  value={state.profile.year}
                  onChange={(e) => dispatch({ type: "profile/patch", patch: { year: e.target.value } })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Institucioni">
                  <Input
                    value={state.profile.institution}
                    onChange={(e) =>
                      dispatch({ type: "profile/patch", patch: { institution: e.target.value } })
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Target size={15} className="text-muted" />
              <h3 className="text-[15px] font-semibold text-ink">Objektivat</h3>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Objektivat ndryshojnë peshat që përdor planifikuesi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const on = state.goals.includes(g.key);
                return (
                  <button
                    key={g.key}
                    onClick={() =>
                      dispatch({
                        type: "goals/set",
                        goals: on
                          ? state.goals.filter((x) => x !== g.key)
                          : [...state.goals, g.key],
                      })
                    }
                    className={
                      on
                        ? "rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand"
                        : "rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-sunken"
                    }
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card padded={false}>
            <div className="px-5 pb-2 pt-4">
              <p className="text-[13px] font-medium text-ink">Lëndët e mia</p>
            </div>
            <div className="divide-y divide-line">
              {state.subjects.map((s) => (
                <Link
                  key={s.id}
                  href={`/lendet/${s.id}`}
                  className="block px-5 py-3 transition-colors hover:bg-sunken"
                >
                  <div className="flex items-center gap-2">
                    <SubjectDot toneIndex={s.tone} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.name}</span>
                    <span className="num text-[13px] font-semibold text-muted">
                      {currentGrade(state, s.id).toFixed(1)}
                    </span>
                  </div>
                  <Progress value={subjectProgress(s)} className="mt-2" height={4} />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-warn" />
              <p className="text-[13px] font-medium text-ink">Arritje</p>
            </div>
            <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
              {[
                { label: "Seri 7-ditore", done: state.streak >= 7 },
                { label: "10 orë mësim", done: totalMinutes >= 600 },
                { label: "50 sesione", done: doneSessions >= 50 },
                { label: "Javë me 100% konsistencë", done: ws.consistency === 100 },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between gap-3">
                  <span className={a.done ? "text-ink" : "text-faint"}>{a.label}</span>
                  {a.done ? <Badge tone="ok">Arritur</Badge> : <Badge>Në progres</Badge>}
                </div>
              ))}
            </div>
          </Card>

          <Link href="/onboarding">
            <Button className="w-full">Rikonfiguro nga fillimi</Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}
