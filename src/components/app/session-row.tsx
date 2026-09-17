"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarClock,
  Check,
  Coffee,
  Ellipsis,
  GraduationCap,
  ListTodo,
  MapPin,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, dur, minutesOf, shortDate } from "@/lib/date";
import { CLASS_LABEL, SESSION_LABEL, findSlot, type AgendaItem } from "@/lib/planner";
import { Badge, Button, IconButton, Modal, cx, useTone, useToast } from "@/components/ui";

/**
 * One row in the day's agenda. Lectures, study sessions, breaks, group
 * sessions, exams and deadlines all render through here so the day reads as a
 * single timeline rather than five separate lists.
 */
export function AgendaRow({
  item,
  now,
  onAsk,
}: {
  item: AgendaItem;
  now?: string;
  onAsk?: (q: string) => void;
}) {
  const { state, dispatch, today } = useStore();
  const [menu, setMenu] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [review, setReview] = useState(false);
  const toast = useToast();

  const subject = state.subjects.find((s) => s.id === item.subjectId);
  const c = useTone(subject?.tone ?? 0);

  const isNow =
    now != null &&
    minutesOf(item.start) <= minutesOf(now) &&
    minutesOf(item.end) > minutesOf(now);

  const done = item.status === "done";
  const missed = item.status === "missed";
  const isBreak = item.kind === "pushim";

  const Icon =
    item.type === "class"
      ? MapPin
      : item.type === "exam"
        ? GraduationCap
        : item.type === "assignment"
          ? ListTodo
          : item.type === "group"
            ? Users
            : isBreak
              ? Coffee
              : Play;

  return (
    <>
      <div
        className={cx(
          "group relative flex gap-3 rounded-[12px] border px-3.5 py-3 transition-all duration-200 sm:gap-4",
          isNow
            ? "border-brand bg-brand-soft/40 shadow-[var(--shadow-sm)]"
            : "border-line bg-surface hover:shadow-[var(--shadow-sm)]",
          done && "opacity-60",
          isBreak && "border-dashed bg-transparent"
        )}
      >
        {/* time column */}
        <div className="w-[52px] shrink-0 pt-0.5">
          <div className="num text-[13.5px] font-semibold text-ink">{item.start}</div>
          {!isBreak && item.minutes > 0 && (
            <div className="num mt-0.5 text-[11.5px] text-faint">{dur(item.minutes)}</div>
          )}
        </div>

        {/* colour rail */}
        <div
          className="w-[3px] shrink-0 rounded-full"
          style={{ background: item.type === "session" || item.type === "class" ? c.fg : "var(--line)" }}
        />

        {/* body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cx(
                "text-[14.5px] font-medium text-ink",
                done && "line-through decoration-faint"
              )}
            >
              {item.title}
            </span>
            {isNow && <Badge tone="brand">Tani</Badge>}
            {missed && <Badge tone="warn">I humbur</Badge>}
            {done && <Badge tone="ok">U krye</Badge>}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
            {item.subtitle && <span>{item.subtitle}</span>}
            {item.type === "class" && item.kind && (
              <span className="text-faint">{CLASS_LABEL[item.kind]}</span>
            )}
            {item.type === "session" && item.kind && !isBreak && (
              <span className="text-faint">{SESSION_LABEL[item.kind]}</span>
            )}
            {item.room && (
              <span className="inline-flex items-center gap-1 text-faint">
                <MapPin size={11} />
                {item.room}
              </span>
            )}
          </div>

          {item.session?.objective && !done && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              <span className="text-faint">Objektivi: </span>
              {item.session.objective}
            </p>
          )}

          {item.session?.why && !done && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-ai">
              <Sparkles size={11} className="mt-[3px] shrink-0" />
              {item.session.why}
            </p>
          )}
        </div>

        {/* actions */}
        {item.type === "session" && !isBreak && !done && (
          <div className="flex shrink-0 items-start gap-1">
            <Link href={`/mesim/${item.id}`} className="hidden sm:block">
              <Button size="sm" variant={isNow ? "primary" : "secondary"}>
                <Play size={12} />
                Fillo
              </Button>
            </Link>
            <IconButton label="Përfundo" onClick={() => setReview(true)}>
              <Check size={15} />
            </IconButton>
            <IconButton label="Më shumë" onClick={() => setMenu(true)}>
              <Ellipsis size={15} />
            </IconButton>
          </div>
        )}

        {item.type === "session" && done && (
          <div className="flex shrink-0 items-start">
            <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check size={13} />
            </span>
          </div>
        )}

        {item.type === "class" && (
          <div className="hidden shrink-0 items-start sm:flex">
            <Icon size={15} className="mt-1.5 text-faint" />
          </div>
        )}

        {item.type === "group" && (
          <Link href="/mso-bashke" className="shrink-0">
            <Button size="sm">Bashkohu</Button>
          </Link>
        )}
      </div>

      {/* ── session menu ───────────────────────────────── */}
      <Modal open={menu} onClose={() => setMenu(false)} title={item.title}>
        <div className="flex flex-col gap-1">
          <MenuItem
            icon={Play}
            label="Fillo sesionin"
            sub="Hap modalitetin e fokusit"
            href={`/mesim/${item.id}`}
          />
          <MenuItem
            icon={Check}
            label="Shëno si të përfunduar"
            onClick={() => {
              setMenu(false);
              setReview(true);
            }}
          />
          <MenuItem
            icon={CalendarClock}
            label="Shtyje për nesër"
            sub="Në slotin e parë të lirë"
            onClick={() => {
              const slot = findSlot(state, addDays(today, 1), item.minutes, [item.id]);
              if (!slot) {
                toast("Nuk gjeta kohë të lirë nesër.");
                return;
              }
              dispatch({ type: "session/move", id: item.id, date: slot.date, start: slot.start });
              toast(`U zhvendos për ${shortDate(slot.date)} në ${slot.start}.`);
              setMenu(false);
            }}
          />
          <MenuItem
            icon={CalendarClock}
            label="Zgjedh kohën vetë"
            onClick={() => {
              setMenu(false);
              setReschedule(true);
            }}
          />
          {onAsk && (
            <MenuItem
              icon={Sparkles}
              label="Pyet AI për këtë temë"
              onClick={() => {
                onAsk(`Ma shpjego ${item.title}.`);
                setMenu(false);
              }}
            />
          )}
          <MenuItem
            icon={Ellipsis}
            label="Anulo sesionin"
            danger
            onClick={() => {
              dispatch({ type: "session/remove", id: item.id });
              toast("Sesioni u hoq nga plani.");
              setMenu(false);
            }}
          />
        </div>
      </Modal>

      <RescheduleModal
        open={reschedule}
        onClose={() => setReschedule(false)}
        sessionId={item.id}
        minutes={item.minutes}
      />

      <ReviewModal open={review} onClose={() => setReview(false)} sessionId={item.id} />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  sub,
  onClick,
  href,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const inner = (
    <>
      <Icon size={15} className={danger ? "text-bad" : "text-faint"} />
      <span className="flex-1">
        <span className={cx("block text-[13.5px] font-medium", danger ? "text-bad" : "text-ink")}>
          {label}
        </span>
        {sub && <span className="block text-[12px] text-faint">{sub}</span>}
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-sunken";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ============================================================
   Reschedule
   ============================================================ */

export function RescheduleModal({
  open,
  onClose,
  sessionId,
  minutes,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  minutes: number;
}) {
  const { state, dispatch, today, refresh } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(addDays(today, 1));
  const [start, setStart] = useState("18:00");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const suggestion = findSlot(state, today, minutes, [sessionId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Riplanifiko sesionin"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: "session/move", id: sessionId, date, start });
              toast(`U zhvendos për ${shortDate(date)} në ${start}.`);
              onClose();
            }}
          >
            Ruaj
          </Button>
        </>
      }
    >
      <button
        disabled={aiBusy}
        onClick={async () => {
          setAiBusy(true);
          setAiError(null);
          try {
            const res = await fetch("/api/ai/reschedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setAiError(data.error ?? "Riplanifikimi dështoi.");
              return;
            }
            await refresh();
            toast(`AI e zhvendosi te ${shortDate(data.date)} në ${data.startTime}.`);
            onClose();
          } catch {
            setAiError("Lidhja dështoi. Provo përsëri.");
          } finally {
            setAiBusy(false);
          }
        }}
        className="mb-3 flex w-full items-center gap-3 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-3 text-left disabled:opacity-60"
      >
        <Sparkles size={16} className="shrink-0 text-ai" />
        <span className="flex-1">
          <span className="block text-[13.5px] font-medium text-ink">
            {aiBusy ? "AI po kërkon kohën më të mirë…" : "Riplanifiko me AI"}
          </span>
          <span className="block text-[12.5px] text-muted">
            Sipas orarit, afateve dhe kohës sate të lirë
          </span>
        </span>
      </button>

      {aiError && (
        <p className="mb-3 rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {aiError}
        </p>
      )}

      {suggestion && (
        <button
          onClick={() => {
            dispatch({
              type: "session/move",
              id: sessionId,
              date: suggestion.date,
              start: suggestion.start,
            });
            toast("U zhvendos te slloti i parë i lirë.");
            onClose();
          }}
          className="mb-4 flex w-full items-center gap-3 rounded-[10px] border border-line px-3.5 py-3 text-left transition-colors hover:bg-sunken"
        >
          <CalendarClock size={16} className="shrink-0 text-muted" />
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-ink">
              Slloti i parë i lirë
            </span>
            <span className="block text-[12.5px] text-muted">
              {shortDate(suggestion.date)} në {suggestion.start}
            </span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Ora</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          />
        </label>
      </div>
      <p className="mt-3 text-[12.5px] text-faint">
        Pas zhvendosjes, plani i pjesës tjetër të javës rillogaritet automatikisht.
      </p>
    </Modal>
  );
}

/* ============================================================
   Post-session review — feeds the planner
   ============================================================ */

const RATINGS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 4, label: "Shumë mirë" },
  { value: 3, label: "Mirë" },
  { value: 2, label: "Mesatarisht" },
  { value: 1, label: "Vështirë" },
];

export function ReviewModal({
  open,
  onClose,
  sessionId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onDone?: () => void;
}) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | null>(null);
  const [understanding, setUnderstanding] = useState<number | null>(null);

  function finish() {
    dispatch({
      type: "session/complete",
      id: sessionId,
      rating: rating ?? undefined,
      understanding: (understanding ?? undefined) as 1 | 2 | 3 | 4 | 5 | undefined,
    });
    toast(
      understanding && understanding >= 4
        ? "Sesioni u përfundua — tema u përditësua."
        : "Sesioni u përfundua."
    );
    setRating(null);
    setUnderstanding(null);
    onClose();
    onDone?.();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Si shkoi ky sesion?"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={finish} disabled={!rating}>
            Ruaj
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRating(r.value)}
            className={cx(
              "rounded-[10px] border px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              rating === r.value
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-muted hover:bg-sunken"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[13.5px] font-medium text-ink">Sa e kuptove?</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => setUnderstanding(v)}
              className={cx(
                "num h-10 flex-1 rounded-[10px] border text-[14px] font-semibold transition-colors",
                understanding === v
                  ? "border-brand bg-brand text-white"
                  : "border-line text-muted hover:bg-sunken"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[12.5px] text-faint">
          Këtë e përdor për të planifikuar sesionet e ardhshme — temat që i kupton mirë i
          përsërisim më rrallë.
        </p>
      </div>
    </Modal>
  );
}
