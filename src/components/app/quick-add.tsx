"use client";

import { useState } from "react";
import { CalendarDays, GraduationCap, ListTodo, StickyNote, Timer } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays } from "@/lib/date";
import type { ClassEntry, DayIndex } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea, cx, useToast } from "@/components/ui";
import { DAYS_LONG } from "@/lib/date";

type Kind = "detyre" | "provim" | "ligjerate" | "sesion" | "shenim";

const KINDS: { key: Kind; label: string; icon: React.ElementType }[] = [
  { key: "detyre", label: "Detyrë", icon: ListTodo },
  { key: "provim", label: "Provim", icon: GraduationCap },
  { key: "ligjerate", label: "Ligjëratë", icon: CalendarDays },
  { key: "sesion", label: "Sesion", icon: Timer },
  { key: "shenim", label: "Shënim", icon: StickyNote },
];

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("detyre");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id ?? "");
  const [date, setDate] = useState(addDays(today, 3));
  const [start, setStart] = useState("18:00");
  const [minutes, setMinutes] = useState(45);
  const [day, setDay] = useState<DayIndex>(0);
  const [end, setEnd] = useState("09:30");
  const [classKind, setClassKind] = useState<ClassEntry["kind"]>("ligjerate");
  const [body, setBody] = useState("");

  function reset() {
    setTitle("");
    setBody("");
  }

  function submit() {
    if (!title.trim() && kind !== "shenim") return;
    const id = `${kind}-${Date.now().toString(36)}`;

    if (kind === "detyre") {
      dispatch({
        type: "assignment/add",
        assignment: {
          id,
          subjectId,
          title: title.trim(),
          detail: body.trim(),
          due: date,
          progress: 0,
          estMinutes: minutes * 2,
          done: false,
          steps: [],
        },
      });
      toast("Detyra u shtua.");
    } else if (kind === "provim") {
      dispatch({
        type: "exam/add",
        exam: {
          id,
          subjectId,
          title: title.trim(),
          kind: "kolokvium",
          date,
          start,
          room: "—",
          targetGrade: state.subjects.find((s) => s.id === subjectId)?.targetGrade ?? 9,
          studiedMinutes: 0,
          topicIds: state.subjects.find((s) => s.id === subjectId)?.topics.map((t) => t.id) ?? [],
        },
      });
      toast("Provimi u shtua në kalendar.");
    } else if (kind === "ligjerate") {
      dispatch({
        type: "class/add",
        entry: { id, subjectId, day, start, end, kind: classKind, room: title.trim() || "—" },
      });
      toast("Ligjërata u shtua në orar.");
    } else if (kind === "sesion") {
      dispatch({
        type: "session/add",
        session: {
          id,
          subjectId,
          kind: "mesim",
          title: title.trim(),
          date,
          start,
          minutes,
          status: "planned",
          why: "Shtuar manualisht nga ti.",
        },
      });
      toast("Sesioni u shtua në plan.");
    } else {
      dispatch({
        type: "note/save",
        note: {
          id,
          subjectId,
          title: title.trim() || "Shënim pa titull",
          body: body.trim(),
          updatedAt: today,
        },
      });
      toast("Shënimi u ruajt.");
    }

    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shto shpejt"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={submit}>
            Shto
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={cx(
              "flex flex-col items-center gap-1.5 rounded-[10px] border px-1 py-2.5 text-[11.5px] font-medium transition-colors",
              kind === k.key
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-muted hover:bg-sunken"
            )}
          >
            <k.icon size={16} />
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3.5">
        <Field label={kind === "ligjerate" ? "Salla" : "Titulli"}>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === "detyre"
                ? "p.sh. Detyra 4 — Indekset"
                : kind === "provim"
                  ? "p.sh. Kolokviumi i dytë"
                  : kind === "ligjerate"
                    ? "p.sh. Salla 301"
                    : kind === "sesion"
                      ? "p.sh. SQL Joins"
                      : "p.sh. Formulat kryesore"
            }
          />
        </Field>

        <Field label="Lënda">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        {kind === "ligjerate" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dita">
                <Select value={day} onChange={(e) => setDay(Number(e.target.value) as DayIndex)}>
                  {DAYS_LONG.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lloji">
                <Select
                  value={classKind}
                  onChange={(e) => setClassKind(e.target.value as ClassEntry["kind"])}
                >
                  <option value="ligjerate">Ligjëratë</option>
                  <option value="ushtrime">Ushtrime</option>
                  <option value="lab">Laborator</option>
                  <option value="seminar">Seminar</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fillon">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Mbaron">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          </>
        ) : kind === "shenim" ? (
          <Field label="Përmbajtja">
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={kind === "detyre" ? "Afati" : "Data"}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {kind === "detyre" ? (
              <Field label="Kohëzgjatja e vlerësuar" hint="minuta punë në total">
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={minutes * 2}
                  onChange={(e) => setMinutes(Number(e.target.value) / 2)}
                />
              </Field>
            ) : (
              <Field label="Ora">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {kind === "sesion" && (
          <Field label="Kohëzgjatja">
            <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[25, 30, 35, 45, 50, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
        )}

        {kind === "detyre" && (
          <Field label="Përshkrimi" hint="Opsionale">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
