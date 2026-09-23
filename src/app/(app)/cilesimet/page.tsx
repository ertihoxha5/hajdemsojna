"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Download,
  LogOut,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Trash,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { signOutAction } from "@/server/auth-actions";
import { VerifyEmailBanner } from "@/components/app/verify-email-banner";
import { LinkedAccounts } from "@/components/app/linked-accounts";
import { DAYS_LONG } from "@/lib/date";
import type { DayIndex } from "@/lib/types";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Toggle,
  cx,
  useToast,
} from "@/components/ui";

export default function SettingsPage() {
  const { state, dispatch, theme, toggleTheme, today } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const av = state.availability;

  function setWindow(day: DayIndex, field: "from" | "to", value: string) {
    const windows = av.windows.some((w) => w.day === day)
      ? av.windows.map((w) => (w.day === day ? { ...w, [field]: value } : w))
      : [...av.windows, { day, from: "17:00", to: "20:00", [field]: value }];
    dispatch({ type: "availability/patch", patch: { windows } });
  }

  function toggleDay(day: DayIndex) {
    const has = av.windows.some((w) => w.day === day);
    dispatch({
      type: "availability/patch",
      patch: has
        ? { windows: av.windows.filter((w) => w.day !== day) }
        : { windows: [...av.windows, { day, from: "17:00", to: "20:00" }] },
    });
  }

  return (
    <div>
      <PageHeader title="Cilësimet" question="Si dua të punojë aplikacioni për mua?" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Availability ───────────────────────────── */}
        <Card className="lg:col-span-2">
          <h2 className="text-[15px] font-semibold text-ink">Kur mundesh me mësu?</h2>
          <p className="mt-1 text-[13px] text-muted">
            Planifikuesi vendos sesione vetëm brenda këtyre orëve — dhe kurrë mbi ligjëratat.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {DAYS_LONG.map((label, i) => {
              const day = i as DayIndex;
              const w = av.windows.find((x) => x.day === day);
              const free = av.freeDays.includes(day);
              return (
                <div
                  key={label}
                  className={cx(
                    "flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-2.5",
                    w ? "border-line bg-surface" : "border-dashed border-line"
                  )}
                >
                  <button
                    onClick={() => toggleDay(day)}
                    className={cx(
                      "w-28 text-left text-[13.5px] font-medium transition-colors",
                      w ? "text-ink" : "text-faint"
                    )}
                  >
                    {label}
                  </button>

                  {w ? (
                    <>
                      <Input
                        type="time"
                        value={w.from}
                        onChange={(e) => setWindow(day, "from", e.target.value)}
                        className="num w-28"
                      />
                      <span className="text-faint">–</span>
                      <Input
                        type="time"
                        value={w.to}
                        onChange={(e) => setWindow(day, "to", e.target.value)}
                        className="num w-28"
                      />
                      <button
                        onClick={() => toggleDay(day)}
                        className="ml-auto text-[12.5px] text-muted hover:text-bad"
                      >
                        Hiq
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleDay(day)}
                      className="text-[13px] text-brand hover:underline"
                    >
                      {free ? "Ditë e lirë — shto orar" : "Shto orar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Study preferences ──────────────────────── */}
        <Card>
          <h2 className="text-[15px] font-semibold text-ink">Preferencat e mësimit</h2>
          <div className="mt-4 flex flex-col gap-3.5">
            <Field label="Gjatësia e sesionit">
              <Select
                value={av.sessionLength}
                onChange={(e) =>
                  dispatch({
                    type: "availability/patch",
                    patch: { sessionLength: Number(e.target.value) },
                  })
                }
              >
                {[25, 30, 35, 45, 50, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minuta
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pushimi mes sesioneve">
              <Select
                value={av.breakLength}
                onChange={(e) =>
                  dispatch({
                    type: "availability/patch",
                    patch: { breakLength: Number(e.target.value) },
                  })
                }
              >
                {[5, 10, 15, 20].map((m) => (
                  <option key={m} value={m}>
                    {m} minuta
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Maksimumi në ditë">
              <Select
                value={av.maxMinutesPerDay}
                onChange={(e) =>
                  dispatch({
                    type: "availability/patch",
                    patch: { maxMinutesPerDay: Number(e.target.value) },
                  })
                }
              >
                {[60, 90, 120, 150, 180, 240, 300].map((m) => (
                  <option key={m} value={m}>
                    {m / 60} orë
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ritmi">
              <Select
                value={av.rhythm}
                onChange={(e) =>
                  dispatch({
                    type: "availability/patch",
                    patch: { rhythm: e.target.value as "mengjes" | "mbremje" | "fleksibil" },
                  })
                }
              >
                <option value="mengjes">Mëngjesor</option>
                <option value="mbremje">Mbrëmjesor</option>
                <option value="fleksibil">Fleksibil</option>
              </Select>
            </Field>
          </div>
        </Card>

        {/* ── Appearance & privacy ───────────────────── */}
        <div className="flex flex-col gap-4">
          <Link href="/cilesimet/ai">
            <Card hover className="transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ai-soft text-ai">
                  <Sparkles size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">AI Asistenti</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Ofruesi, modeli, kreativiteti dhe çelësi yt API
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </div>
            </Card>
          </Link>

          <Card>
            <h2 className="text-[15px] font-semibold text-ink">Pamja</h2>
            <div className="mt-3 flex gap-2">
              {[
                { key: "light", label: "E çelët", icon: Sun },
                { key: "dark", label: "E errët", icon: Moon },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    if (theme !== t.key) toggleTheme();
                  }}
                  className={cx(
                    "flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    theme === t.key
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-muted hover:bg-sunken"
                  )}
                >
                  <t.icon size={15} />
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-ink">Privatësia</h2>
            <div className="mt-1 divide-y divide-line">
              <Toggle
                label="Statusi i mësimit"
                description="Miqtë shohin kur je duke mësuar"
                checked={state.privacy.shareStatus}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareStatus" })}
              />
              <Toggle
                label="Orari"
                checked={state.privacy.shareSchedule}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareSchedule" })}
              />
              <Toggle
                label="Progresi"
                checked={state.privacy.shareProgress}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareProgress" })}
              />
              <Toggle
                label="Notat"
                description="Private si parazgjedhje"
                checked={state.privacy.shareGrades}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareGrades" })}
              />
            </div>
          </Card>

          <VerifyEmailBanner />

          <Card>
            <h2 className="text-[15px] font-semibold text-ink">Llogaria dhe të dhënat</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Të dhënat e tua ruhen në llogarinë tënde dhe janë të dukshme vetëm për ty.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  dispatch({ type: "plan/generate", from: today });
                  toast("Plani po rigjenerohet…");
                }}
              >
                <RotateCcw size={13} />
                Rigjenero planin
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary">
                  <LogOut size={13} />
                  Dil nga llogaria
                </Button>
              </form>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <Trash size={13} />
                Fshij llogarinë
              </Button>
            </div>

            <LinkedAccounts />

            {/* Being able to leave with the data is the other half of being
                able to delete the account. Plain links, so the browser handles
                the download and nothing has to be held in memory. */}
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[13px] font-medium text-ink">Merri të dhënat me vete</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Shkarko gjithçka që ke shtuar, ose vetëm orarin për ta hapur në
                Google Calendar, Apple Calendar apo Outlook.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="/api/account/export" download>
                  <Button variant="secondary" size="sm" type="button">
                    <Download size={13} />
                    Shkarko të dhënat (JSON)
                  </Button>
                </a>
                <a href="/api/calendar" download>
                  <Button variant="secondary" size="sm" type="button">
                    <CalendarDays size={13} />
                    Shkarko orarin (.ics)
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Fshij llogarinë"
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Anulo</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/api/account", { method: "DELETE" });
                if (res.ok) {
                  router.replace("/");
                  router.refresh();
                } else {
                  setBusy(false);
                  setConfirmReset(false);
                  toast("Fshirja dështoi. Provo përsëri.");
                }
              }}
            >
              {busy ? "Duke fshirë…" : "Fshij përfundimisht"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          Kjo fshin llogarinë tënde dhe çdo gjë brenda saj — lëndët, orarin, detyrat, provimet,
          notat, shënimet dhe bisedat me AI. Veprimi nuk kthehet mbrapsht.
        </p>
      </Modal>
    </div>
  );
}
