"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { useStore } from "@/lib/store";
import { DAYS_SHORT, dayIndex, minutesOf, parseISO, timeOf } from "@/lib/date";
import { CLASS_LABEL, agendaFor, type AgendaItem } from "@/lib/planner";
import { tone } from "@/lib/tone";
import { cx, useToast } from "@/components/ui";

const HOUR_START = 7;
const HOUR_END = 23;
const PX_PER_HOUR = 54;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

type DragPayload = { kind: "session" | "class"; id: string; minutes: number };

/**
 * The week canvas: lectures, study sessions, group sessions and exams laid out
 * against real time. Study sessions and lectures can be dragged to a new slot;
 * dropping one moves it and lets the planner rebalance from there.
 */
export function WeekGrid({
  days,
  editable = true,
  onMoved,
  showClasses = true,
  showSessions = true,
}: {
  days: string[];
  editable?: boolean;
  onMoved?: () => void;
  showClasses?: boolean;
  showSessions?: boolean;
}) {
  const { state, dispatch, theme, today, now } = useStore();
  const toast = useToast();
  const dragRef = useRef<DragPayload | null>(null);
  const [hover, setHover] = useState<{ day: string; mins: number } | null>(null);

  const nowMins = minutesOf(now);

  function snap(y: number, height: number) {
    const mins = HOUR_START * 60 + (y / height) * (HOUR_END - HOUR_START) * 60;
    return Math.max(HOUR_START * 60, Math.round(mins / 15) * 15);
  }

  function handleDrop(date: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const payload = dragRef.current;
    setHover(null);
    if (!payload) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = snap(e.clientY - rect.top, rect.height);

    if (payload.kind === "session") {
      dispatch({ type: "session/move", id: payload.id, date, start: timeOf(mins) });
      toast(`U zhvendos në ${DAYS_SHORT[dayIndex(date)]} ${timeOf(mins)}.`);
    } else {
      const entry = state.classes.find((c) => c.id === payload.id);
      if (entry) {
        dispatch({
          type: "class/move",
          id: payload.id,
          day: dayIndex(date),
          start: timeOf(mins),
          end: timeOf(mins + payload.minutes),
        });
        toast(`Ligjërata u zhvendos në ${DAYS_SHORT[dayIndex(date)]} ${timeOf(mins)}.`);
      }
    }
    dragRef.current = null;
    onMoved?.();
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {/* header */}
      <div className="flex border-b border-line bg-surface">
        <div className="w-[52px] shrink-0" />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div
              key={d}
              className={cx(
                "flex-1 border-l border-line px-2 py-2.5 text-center",
                isToday && "bg-brand-soft/40"
              )}
            >
              <div className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">
                {DAYS_SHORT[dayIndex(d)]}
              </div>
              <div
                className={cx(
                  "num mt-0.5 text-[15px] font-semibold",
                  isToday ? "text-brand" : "text-ink"
                )}
              >
                {parseISO(d).getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* body */}
      <div className="relative flex max-h-[62vh] overflow-y-auto">
        <div className="sticky left-0 z-10 w-[52px] shrink-0 bg-surface">
          {HOURS.map((h) => (
            <div
              key={h}
              className="num relative text-right text-[11px] text-faint"
              style={{ height: PX_PER_HOUR }}
            >
              <span className="absolute -top-1.5 right-2">{`${h}`.padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {days.map((date) => {
          const items = agendaFor(state, date).filter((i) => {
            if (i.kind === "pushim") return false;
            if (i.type === "class") return showClasses;
            if (i.type === "session") return showSessions;
            return true;
          });
          const isToday = date === today;

          return (
            <div
              key={date}
              onDragOver={(e) => {
                if (!editable) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setHover({ day: date, mins: snap(e.clientY - rect.top, rect.height) });
              }}
              onDragLeave={() => setHover((h) => (h?.day === date ? null : h))}
              onDrop={(e) => editable && handleDrop(date, e)}
              className={cx(
                "timetable-grid relative flex-1 border-l border-line",
                isToday && "bg-brand-soft/15"
              )}
              style={{
                height: (HOUR_END - HOUR_START) * PX_PER_HOUR,
                backgroundSize: `100% ${PX_PER_HOUR}px`,
              }}
            >
              {/* current-time marker */}
              {isToday && nowMins >= HOUR_START * 60 && nowMins <= HOUR_END * 60 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: ((nowMins - HOUR_START * 60) / 60) * PX_PER_HOUR }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-bad" />
                  <span className="h-px flex-1 bg-bad" />
                </div>
              )}

              {/* drop preview */}
              {hover?.day === date && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-20 rounded-[6px] border border-dashed border-brand bg-brand-soft/60"
                  style={{
                    top: ((hover.mins - HOUR_START * 60) / 60) * PX_PER_HOUR,
                    height: 30,
                  }}
                >
                  <span className="num absolute left-1.5 top-1 text-[10.5px] font-medium text-brand">
                    {timeOf(hover.mins)}
                  </span>
                </div>
              )}

              {items.map((item) => (
                <EventBlock
                  key={item.id}
                  item={item}
                  editable={editable}
                  dark={theme === "dark"}
                  onDragStart={(p) => (dragRef.current = p)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({
  item,
  editable,
  dark,
  onDragStart,
}: {
  item: AgendaItem;
  editable: boolean;
  dark: boolean;
  onDragStart: (p: DragPayload) => void;
}) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === item.subjectId);
  const c = tone(subject?.tone ?? 0, dark);

  const top = ((minutesOf(item.start) - HOUR_START * 60) / 60) * PX_PER_HOUR;
  const height = Math.max(22, (item.minutes / 60) * PX_PER_HOUR - 2);
  const draggable = editable && (item.type === "session" || item.type === "class");
  const done = item.status === "done";

  const isExam = item.type === "exam";
  const isGroup = item.type === "group";
  const isAssignment = item.type === "assignment";

  if (isAssignment) {
    return (
      <div
        className="absolute inset-x-1 z-10 truncate rounded-[5px] border border-dashed border-warn bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-medium text-warn"
        style={{ top: top }}
        title={item.title}
      >
        {item.title}
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart({
          kind: item.type === "class" ? "class" : "session",
          id: item.id,
          minutes: item.minutes,
        });
      }}
      className={cx(
        "group absolute inset-x-1 overflow-hidden rounded-[7px] px-1.5 py-1 transition-shadow",
        draggable && "cursor-grab active:cursor-grabbing hover:shadow-[var(--shadow-md)]",
        done && "opacity-50"
      )}
      style={{
        top,
        height,
        background: isExam ? "var(--bad-soft)" : isGroup ? "var(--brand-soft)" : c.bg,
        boxShadow: `inset 2px 0 0 ${isExam ? "var(--bad)" : isGroup ? "var(--brand)" : c.fg}`,
        border:
          item.type === "session"
            ? `1px dashed ${isGroup ? "var(--brand)" : c.ring}`
            : `1px solid transparent`,
      }}
      title={`${item.start}–${item.end} · ${item.title}`}
    >
      <div className="flex items-start gap-1">
        {draggable && (
          <GripVertical
            size={10}
            className="mt-[2px] shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
            style={{ color: c.fg }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cx("truncate text-[11px] font-semibold leading-tight", done && "line-through")}
            style={{ color: isExam ? "var(--bad)" : isGroup ? "var(--brand)" : c.fg }}
          >
            {item.title}
          </div>
          {height > 34 && (
            <div className="num truncate text-[10px] leading-tight opacity-70" style={{ color: c.fg }}>
              {item.start}
              {item.type === "class" && item.kind ? ` · ${CLASS_LABEL[item.kind]}` : ""}
              {item.room ? ` · ${item.room}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
