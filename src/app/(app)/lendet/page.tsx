"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap, ListTodo } from "lucide-react";
import { useStore } from "@/lib/store";
import { relativeDays } from "@/lib/date";
import {
  currentGrade,
  examReadiness,
  nextExamFor,
  subjectProgress,
  topicsDone,
} from "@/lib/planner";
import { Badge, Card, PageHeader, Progress, SubjectDot, useTone } from "@/components/ui";
import type { Subject } from "@/lib/types";

export default function SubjectsPage() {
  const { state } = useStore();

  return (
    <div>
      <PageHeader
        title="Lëndët"
        question="Ku qëndroj në secilën lëndë?"
        right={
          <span className="text-[13px] text-muted">
            {state.subjects.length} lëndë · {state.subjects.reduce((s, x) => s + x.credits, 0)} ECTS
          </span>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.subjects.map((s, i) => (
          <SubjectCard key={s.id} subject={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function SubjectCard({ subject, index }: { subject: Subject; index: number }) {
  const { state, today } = useStore();
  const c = useTone(subject.tone);
  const progress = subjectProgress(subject);
  const grade = currentGrade(state, subject.id);
  const exam = nextExamFor(state, subject.id, today);
  const open = state.assignments.filter((a) => !a.done && a.subjectId === subject.id).length;

  return (
    <Link href={`/lendet/${subject.id}`} className={`anim-in anim-delay-${Math.min(index + 1, 5)}`}>
      <Card hover className="h-full transition-transform duration-200 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SubjectDot toneIndex={subject.tone} />
              <h3 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">
                {subject.name}
              </h3>
            </div>
            <p className="mt-1 truncate text-[12.5px] text-muted">{subject.teacher}</p>
          </div>
          <div className="text-right">
            <div className="num text-[20px] font-semibold leading-none" style={{ color: c.fg }}>
              {grade.toFixed(1)}
            </div>
            <div className="num mt-1 text-[11.5px] text-faint">objektivi {subject.targetGrade}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12px] text-muted">Progresi</span>
            <span className="num text-[12.5px] font-medium text-ink">{progress}%</span>
          </div>
          <Progress value={progress} color={c.fg} />
          <p className="num mt-1.5 text-[11.5px] text-faint">
            {topicsDone(subject)} / {subject.topics.length} tema të zotëruara
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {exam && (
            <Badge tone={examReadiness(state, exam) < 60 ? "bad" : "neutral"}>
              <GraduationCap size={11} />
              {relativeDays(today, exam.date)} · {examReadiness(state, exam)}%
            </Badge>
          )}
          {open > 0 && (
            <Badge tone="warn">
              <ListTodo size={11} />
              {open} detyr{open === 1 ? "ë" : "a"}
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-1 text-[12px] text-faint">
            Hap
            <ArrowRight size={12} />
          </span>
        </div>
      </Card>
    </Link>
  );
}
