"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Copy,
  LogOut,
  Pause,
  Play,
  SkipForward,
  Square,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { environmentFor } from "@/lib/spaces/environments";
import { MODE_LABEL, clock } from "@/lib/spaces/session";
import {
  ACTIVITY_BADGE,
  ACTIVITY_LABEL,
  groupFocus,
} from "@/lib/spaces/presence";
import { Button, Card, Field, Input, Modal, Tabs, cx, useToast } from "@/components/ui";
import { StudyMap } from "@/components/spaces/study-map";
import { AmbiencePlayer } from "@/components/spaces/ambience";
import { AvatarFigure } from "@/components/spaces/avatar-figure";
import { useSpace } from "@/components/spaces/use-space";
import { SessionRecap } from "@/components/spaces/session-recap";

/**
 * A study space, live.
 *
 * Layout follows the brief: the map is the centre, the session sits to the
 * left, people and chat to the right, controls along the bottom. On a narrow
 * screen the map stays and the panels become a bottom sheet, because the room
 * is the point — a phone-sized chat window with no room is just a group chat.
 */

const REACTIONS = ["👍", "👏", "☕", "🧠", "🎉"] as const;

export function RoomClient({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const toast = useToast();
  const room = useSpace(spaceId);

  const [tab, setTab] = useState("chat");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Honour the operating system's reduced-motion preference throughout.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [room.messages.length]);

  /**
   * The displayed countdown.
   *
   * Held in state and advanced by a timer rather than computed during render:
   * the value depends on the current time, and reading the clock while
   * rendering makes it depend on when React happens to re-render instead.
   * The authority is still the server's phase start — this only corrects for
   * how long ago the snapshot arrived.
   */
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const session = room.session;
    if (!session) return;

    const tick = () => {
      if (session.paused) {
        setRemaining(session.remaining);
        return;
      }
      const drift = Math.floor((Date.now() - session.at) / 1000);
      setRemaining(Math.max(0, session.remaining - drift));
    };

    // First value lands on the next frame rather than synchronously here.
    const timer = setInterval(tick, 1000);
    const immediate = setTimeout(tick, 0);

    return () => {
      clearInterval(timer);
      clearTimeout(immediate);
    };
  }, [room.session]);

  const env = environmentFor(room.space?.environment ?? "biblioteka");
  const focusMode = room.session?.mode === "focus";
  const isHost =
    room.space && room.me
      ? room.space.ownerId === room.meId || room.me.role === "cohost"
      : false;

  const focusScore = groupFocus(room.members.map((m) => m.activity));

  if (room.error) {
    return (
      <Card className="mx-auto mt-16 max-w-md text-center">
        <p className="text-[14px] text-ink">{room.error}</p>
        <Button className="mt-4" onClick={() => router.push("/mso-bashke")}>
          Kthehu te Mso Bashkë
        </Button>
      </Card>
    );
  }

  if (!room.space) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[13.5px] text-muted">
        Po hapet hapësira…
      </div>
    );
  }

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft("");
    const failed = await room.send(text);
    if (failed) toast(failed);
    setSending(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Top bar ─────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {room.space.name}
          </h1>
          <p className="text-[12.5px] text-muted">
            {env.name} · {room.members.length}/{room.space.maxMembers} studentë
            {room.space.subjectName ? ` · ${room.space.subjectName}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionPill state={room.connection} />

          {room.space.inviteCode && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(
                    `${window.location.origin}/mso-bashke/hyr?kod=${room.space!.inviteCode}`
                  )
                  .then(() => toast("Linku u kopjua."))
                  .catch(() => toast("Nuk u kopjua dot."));
              }}
              className="flex items-center gap-1.5 rounded-[9px] border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-brand"
            >
              <Copy size={13} />
              {room.space.inviteCode}
            </button>
          )}

          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
              router.push("/mso-bashke");
            }}
          >
            <LogOut size={13} />
            Dil
          </Button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[230px_1fr_290px]">
        {/* ── Left: the session ─────────────────────── */}
        <aside className="order-2 flex flex-col gap-3 lg:order-1">
          <Card className="text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              {room.session ? MODE_LABEL[room.session.mode] : "Pa sesion"}
            </p>

            <p
              className={cx(
                "num mt-1 text-[36px] font-semibold leading-none tabular-nums",
                room.session?.mode === "break" ? "text-ok" : "text-ink"
              )}
            >
              {room.session ? clock(remaining) : "--:--"}
            </p>

            {room.session && room.session.mode !== "ended" && (
              <p className="num mt-1.5 text-[12px] text-faint">
                Raundi {room.session.currentRound}/{room.session.totalRounds}
                {room.session.paused && " · në pauzë"}
              </p>
            )}

            {isHost && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {!room.session || room.session.mode === "ended" ? (
                  <Button size="sm" onClick={() => void room.command("start")}>
                    <Play size={13} />
                    Fillo
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void room.command(room.session!.paused ? "resume" : "pause")
                      }
                    >
                      {room.session.paused ? <Play size={13} /> : <Pause size={13} />}
                      {room.session.paused ? "Vazhdo" : "Pauzë"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void room.command("skip")}
                    >
                      <SkipForward size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void room.command("end")}
                    >
                      <Square size={13} />
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>

          <Card>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
              Fokusi i grupit
            </p>
            <p className="num mt-1 text-[24px] font-semibold text-ink">
              {focusScore}%
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-700"
                style={{ width: `${focusScore}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Nga sa veta janë të lidhur dhe aktivë — asgjë nuk vëzhgohet me kamerë.
            </p>
          </Card>

          <Card>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
              Çka po mëson?
            </p>
            {room.me?.studyTopic || room.me?.studySubject ? (
              <div className="mt-1.5">
                <p className="text-[13.5px] font-medium text-ink">
                  {room.me.studySubject || "—"}
                </p>
                <p className="text-[12.5px] text-muted">{room.me.studyTopic}</p>
              </div>
            ) : (
              <p className="mt-1.5 text-[12.5px] text-faint">
                Thuaji grupit me çfarë je marrë.
              </p>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setStatusOpen(true)}
            >
              Përditëso
            </Button>
          </Card>

          <Card>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
              Ambienti
            </p>
            <AmbiencePlayer
              roomAmbient={room.space.ambient}
              synced={room.space.syncAmbient}
              suggests={env.suggests}
            />
          </Card>
        </aside>

        {/* ── Centre: the map ───────────────────────── */}
        <main className="order-1 flex flex-col gap-2 lg:order-2">
          <StudyMap
            environment={env}
            members={room.members}
            meId={room.meId}
            focusMode={focusMode}
            reducedMotion={reducedMotion}
            onMove={room.move}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-faint">
              Lëviz me WASD, shigjetat, ose kliko. Kliko një karrige për t&apos;u ulur.
            </p>

            <div className="flex items-center gap-1">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Reago me ${emoji}`}
                  onClick={() => void room.react(emoji)}
                  className="rounded-lg px-1.5 py-1 text-[15px] transition-transform hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="lg:hidden"
                onClick={() => setPanelOpen(true)}
              >
                <Users size={13} />
                Paneli
              </Button>
            </div>
          </div>

          {/* Reactions float over the room and fade on their own. */}
          {room.reactions.length > 0 && (
            <div className="pointer-events-none flex flex-wrap gap-1.5">
              {room.reactions.map((r) => (
                <span key={r.id} className="anim-pop text-[18px]">
                  {r.emoji}
                </span>
              ))}
            </div>
          )}
        </main>

        {/* ── Right: people, chat, AI ───────────────── */}
        <aside className="order-3 hidden lg:block">
          <SidePanel
            tab={tab}
            setTab={setTab}
            room={room}
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            onSend={send}
            scrollRef={scrollRef}
          />
        </aside>
      </div>

      {/* Mobile panel */}
      {panelOpen && (
        <Modal open onClose={() => setPanelOpen(false)} title="Paneli">
          <SidePanel
            tab={tab}
            setTab={setTab}
            room={room}
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            onSend={send}
            scrollRef={scrollRef}
          />
        </Modal>
      )}

      {room.recap && (
        <SessionRecap
          recap={room.recap}
          meId={room.meId}
          onClose={room.dismissRecap}
        />
      )}

      {statusOpen && (
        <StudyStatusModal
          initial={{
            studySubject: room.me?.studySubject ?? "",
            studyTopic: room.me?.studyTopic ?? "",
            studyGoal: room.me?.studyGoal ?? "",
          }}
          onClose={() => setStatusOpen(false)}
          onSave={async (values) => {
            await room.setStudyStatus({ ...values, goalDone: false });
            setStatusOpen(false);
          }}
        />
      )}

      {/* The check-in. Asked once, answerable, never punitive. */}
      {room.idleTooLong && !checkedIn && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(420px,92vw)] -translate-x-1/2 rounded-[14px] border border-warn/40 bg-surface p-4 shadow-xl">
          <p className="text-[14px] font-medium text-ink">Je ende duke mësuar?</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Koha jote e kredituar ndalon kur je larg — nuk zbritet asgjë, thjesht
            nuk grumbullohet.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                room.confirmPresence();
                setCheckedIn(true);
                setTimeout(() => setCheckedIn(false), 60_000);
              }}
            >
              Po, vazhdo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCheckedIn(true)}>
              Jam në pushim
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Panel
   ============================================================ */

type Room = ReturnType<typeof useSpace>;

function SidePanel({
  tab,
  setTab,
  room,
  draft,
  setDraft,
  sending,
  onSend,
  scrollRef,
}: {
  tab: string;
  setTab: (t: string) => void;
  room: Room;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Card padded={false} className="flex h-[620px] flex-col">
      <div className="px-3 pt-2.5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "chat", label: "Chat" },
            { key: "people", label: `Anëtarët (${room.members.length})` },
          ]}
        />
      </div>

      {tab === "people" ? (
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-2">
            {room.members.map((m) => {
              const badge = ACTIVITY_BADGE[m.activity];
              return (
                <li key={m.userId} className="flex items-center gap-2.5">
                  <AvatarFigure avatar={m.avatar} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {m.isMe ? "Ti" : m.name}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      <span aria-hidden="true">{badge.glyph} </span>
                      {ACTIVITY_LABEL[m.activity]}
                      {m.studyTopic ? ` · ${m.studyTopic}` : ""}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[11.5px] text-faint">
                    {Math.floor(m.focusSeconds / 60)}m
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            {room.messages.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-faint">
                Ende pa mesazhe. Shkruaj i pari — ose pyet me @AI.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {room.messages.map((m) => (
                  <li key={m.id}>
                    <p
                      className={cx(
                        "text-[12px] font-medium",
                        m.isAI ? "text-ai" : "text-muted"
                      )}
                    >
                      {m.authorName}
                    </p>
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                      {m.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-line p-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder="Shkruaj një mesazh… (@AI për ndihmë)"
              aria-label="Shkruaj një mesazh"
              className="max-h-24 flex-1 resize-none rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-brand"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !draft.trim()}
              aria-label="Dërgo"
              className="rounded-[9px] bg-brand p-2 text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function ConnectionPill({ state }: { state: Room["connection"] }) {
  const open = state === "open";
  return (
    <span
      className={cx(
        "flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-medium",
        open ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
      )}
      role="status"
    >
      {open ? <Wifi size={12} /> : <WifiOff size={12} />}
      {open ? "Lidhur" : "Po rilidhet…"}
    </span>
  );
}

function StudyStatusModal({
  initial,
  onClose,
  onSave,
}: {
  initial: { studySubject: string; studyTopic: string; studyGoal: string };
  onClose: () => void;
  onSave: (v: {
    studySubject: string;
    studyTopic: string;
    studyGoal: string;
  }) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} title="Çka po mëson?">
      <div className="flex flex-col gap-3">
        <Field label="Lënda">
          <Input
            value={values.studySubject}
            onChange={(e) =>
              setValues((v) => ({ ...v, studySubject: e.target.value }))
            }
            placeholder="Algoritme"
            autoFocus
          />
        </Field>
        <Field label="Tema">
          <Input
            value={values.studyTopic}
            onChange={(e) =>
              setValues((v) => ({ ...v, studyTopic: e.target.value }))
            }
            placeholder="Dynamic Programming"
          />
        </Field>
        <Field label="Objektivi" hint="Çfarë do të kesh mbaruar në fund?">
          <Input
            value={values.studyGoal}
            onChange={(e) =>
              setValues((v) => ({ ...v, studyGoal: e.target.value }))
            }
            placeholder="Me përfundu kapitullin 4"
          />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Anulo
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(values);
              setBusy(false);
            }}
          >
            Ruaj
          </Button>
        </div>
      </div>
    </Modal>
  );
}
