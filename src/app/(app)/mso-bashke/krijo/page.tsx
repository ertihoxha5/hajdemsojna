"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Globe,
  Lock,
  UserCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  AMBIENCES,
  ENVIRONMENTS,
  SESSION_PRESETS,
  environmentFor,
  sessionTotalMinutes,
} from "@/lib/spaces/environments";
import { Button, Card, Field, Input, Select, Textarea, Toggle, cx, useToast } from "@/components/ui";

/**
 * Creating a space, six steps.
 *
 * Split into steps rather than one long form because the choices are of
 * genuinely different kinds — a name, a privacy decision, a room to sit in, a
 * rhythm to work to. Every step has a sane default, so the whole thing can be
 * completed by pressing Vazhdo six times.
 */

const STEPS = [
  "Emri",
  "Privatësia",
  "Hapësira",
  "Atmosfera",
  "Sesioni",
  "AI",
] as const;

export default function CreateSpacePage() {
  const router = useRouter();
  const toast = useToast();
  const { state } = useStore();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; inviteCode: string } | null>(
    null
  );

  const [form, setForm] = useState({
    name: "",
    about: "",
    subjectId: "",
    privacy: "private" as "public" | "private" | "friends",
    environment: "biblioteka",
    ambient: "rain",
    syncAmbient: false,
    studyMinutes: 50,
    breakMinutes: 10,
    roundCount: 5,
    maxMembers: 8,
    aiSupervisor: true,
    rules: "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const env = environmentFor(form.environment);

  const total = useMemo(
    () =>
      sessionTotalMinutes(form.studyMinutes, form.breakMinutes, form.roundCount),
    [form.studyMinutes, form.breakMinutes, form.roundCount]
  );

  const canContinue = step !== 0 || form.name.trim().length >= 2;

  const create = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subjectId: form.subjectId || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Hapësira nuk u krijua.");
        return;
      }

      setCreated({ id: data.space.id, inviteCode: data.space.inviteCode });
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  };

  /* ── Done ──────────────────────────────────────────── */

  if (created) {
    const link = `${window.location.origin}/mso-bashke/hyr?kod=${created.inviteCode}`;

    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ok-soft text-ok">
            <Check size={20} />
          </div>
          <h1 className="mt-3 text-[20px] font-semibold text-ink">
            Hapësira është gati
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Ndaje kodin ose linkun dhe filloni bashkë.
          </p>

          <div className="mt-5 rounded-[12px] border border-line bg-sunken p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              Kodi
            </p>
            <p className="num mt-1 text-[28px] font-semibold tracking-[0.18em] text-ink">
              {created.inviteCode}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(created.inviteCode)
                  .then(() => toast("Kodi u kopjua."))
                  .catch(() => toast("Nuk u kopjua dot."))
              }
            >
              <Copy size={14} />
              Kopjo kodin
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(link)
                  .then(() => toast("Linku u kopjua."))
                  .catch(() => toast("Nuk u kopjua dot."))
              }
            >
              <Copy size={14} />
              Kopjo linkun
            </Button>
          </div>

          <Button
            className="mt-5 w-full"
            onClick={() => router.push(`/mso-bashke/${created.id}`)}
          >
            Hyr në hapësirë
            <ArrowRight size={15} />
          </Button>
        </Card>
      </div>
    );
  }

  /* ── Wizard ────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-3xl py-6">
      <button
        type="button"
        onClick={() => (step === 0 ? router.push("/mso-bashke") : setStep(step - 1))}
        className="mb-5 flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        {step === 0 ? "Mso Bashkë" : STEPS[step - 1]}
      </button>

      {/* progress */}
      <ol className="mb-6 flex gap-1.5" aria-label="Hapat">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              className={cx(
                "h-1 rounded-full transition-colors",
                i <= step ? "bg-brand" : "bg-line"
              )}
            />
            <span
              className={cx(
                "mt-1.5 hidden text-[11.5px] sm:block",
                i === step ? "font-medium text-ink" : "text-faint"
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <StepCard
          title="Emri i hapësirës"
          hint="Diçka që shokët e njohin menjëherë."
        >
          <Field label="Emri">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Night Study Crew"
              autoFocus
            />
          </Field>
          <Field label="Përshkrimi" hint="Opsionale.">
            <Textarea
              rows={2}
              value={form.about}
              onChange={(e) => set("about", e.target.value)}
              placeholder="Përsëritje para kolokviumit të dytë."
            />
          </Field>
          {state.subjects.length > 0 && (
            <Field label="Lënda">
              <Select
                value={form.subjectId}
                onChange={(e) => set("subjectId", e.target.value)}
              >
                <option value="">Pa lëndë</option>
                {state.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Sa veta maksimum">
            <Input
              type="number"
              min={2}
              max={24}
              value={form.maxMembers}
              onChange={(e) => set("maxMembers", Number(e.target.value))}
            />
          </Field>
        </StepCard>
      )}

      {step === 1 && (
        <StepCard title="Privatësia" hint="Kush mund të hyjë?">
          <div className="flex flex-col gap-2">
            <PrivacyOption
              active={form.privacy === "public"}
              onClick={() => set("privacy", "public")}
              icon={<Globe size={16} />}
              title="Publike"
              body="Kushdo mund ta gjejë dhe të hyjë."
            />
            <PrivacyOption
              active={form.privacy === "private"}
              onClick={() => set("privacy", "private")}
              icon={<Lock size={16} />}
              title="Private"
              body="Vetëm me kod ose link ftese."
            />
            <PrivacyOption
              active={form.privacy === "friends"}
              onClick={() => set("privacy", "friends")}
              icon={<UserCheck size={16} />}
              title="Vetëm shokët"
              body="Vetëm shokët e tu të pranuar."
            />
          </div>

          <Field
            label="Rregullat e hapësirës"
            hint="Një rregull për rresht. Shfaqen para se dikush të hyjë."
          >
            <Textarea
              rows={3}
              value={form.rules}
              onChange={(e) => set("rules", e.target.value)}
              placeholder={"Mikrofoni vetëm gjatë pushimit\nShqip"}
            />
          </Field>
        </StepCard>
      )}

      {step === 2 && (
        <StepCard title="Zgjidh hapësirën" hint="Ku do të uleni?">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ENVIRONMENTS.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => {
                  set("environment", e.key);
                  // Follow the room's own suggestion unless one was chosen.
                  set("ambient", e.suggests[0] ?? "none");
                }}
                className={cx(
                  "overflow-hidden rounded-[12px] border text-left transition-all",
                  form.environment === e.key
                    ? "border-brand ring-2 ring-brand/30"
                    : "border-line hover:border-brand/50"
                )}
              >
                {/* The thumbnail is the real palette, so what you pick is
                    literally what the room will look like. */}
                <div
                  className="h-16 w-full"
                  style={{
                    background: `radial-gradient(90% 80% at 50% 10%, ${e.palette.glow}55 0%, ${e.palette.wall} 45%, ${e.palette.floor} 100%)`,
                  }}
                />
                <div className="p-2">
                  <p className="text-[12.5px] font-medium text-ink">{e.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">
                    {e.tagline}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="Atmosfera"
          hint="Çdo student e dëgjon veç për vete, përveç nëse e sinkronizon."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AMBIENCES.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => set("ambient", a.key)}
                className={cx(
                  "rounded-[10px] border px-3 py-2.5 text-left text-[13px] transition-colors",
                  form.ambient === a.key
                    ? "border-brand bg-brand-soft text-ink"
                    : "border-line text-muted hover:border-brand/50"
                )}
              >
                {a.name}
                {env.suggests.includes(a.key) && (
                  <span className="mt-0.5 block text-[11px] text-faint">
                    Shkon me {env.name}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-[10px] border border-line px-3">
            <Toggle
              checked={form.syncAmbient}
              onChange={(v) => set("syncAmbient", v)}
              label="Sinkronizo ambientin me grupin"
              description="Jashtë kësaj, secili e zgjedh vetë — dikush mëson me shi, dikush në heshtje."
            />
          </div>
        </StepCard>
      )}

      {step === 4 && (
        <StepCard title="Sesioni" hint="Sa gjatë punoni dhe sa pushoni.">
          <div className="grid gap-2 sm:grid-cols-3">
            {SESSION_PRESETS.map((p) => {
              const active =
                form.studyMinutes === p.studyMinutes &&
                form.breakMinutes === p.breakMinutes &&
                form.roundCount === p.rounds;

              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    set("studyMinutes", p.studyMinutes);
                    set("breakMinutes", p.breakMinutes);
                    set("roundCount", p.rounds);
                  }}
                  className={cx(
                    "rounded-[12px] border px-3 py-3 text-left transition-colors",
                    active ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"
                  )}
                >
                  <p className="num text-[17px] font-semibold text-ink">{p.name}</p>
                  <p className="text-[12px] text-muted">{p.note}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Field label="Fokus (min)">
              <Input
                type="number"
                min={5}
                max={180}
                value={form.studyMinutes}
                onChange={(e) => set("studyMinutes", Number(e.target.value))}
              />
            </Field>
            <Field label="Pushim (min)">
              <Input
                type="number"
                min={0}
                max={60}
                value={form.breakMinutes}
                onChange={(e) => set("breakMinutes", Number(e.target.value))}
              />
            </Field>
            <Field label="Raunde">
              <Input
                type="number"
                min={1}
                max={12}
                value={form.roundCount}
                onChange={(e) => set("roundCount", Number(e.target.value))}
              />
            </Field>
          </div>

          <p className="mt-3 text-[13px] text-muted">
            Gjithsej:{" "}
            <span className="num font-medium text-ink">
              {Math.floor(total / 60)}h {total % 60}m
            </span>
            <span className="text-faint">
              {" "}
              — pas raundit të fundit nuk ka pushim.
            </span>
          </p>
        </StepCard>
      )}

      {step === 5 && (
        <StepCard title="AI Supervisor" hint="Një lehtësues, jo një mbikëqyrës.">
          <div className="rounded-[10px] border border-line px-3">
            <Toggle
              checked={form.aiSupervisor}
              onChange={(v) => set("aiSupervisor", v)}
              label="Aktivizo AI Supervisor"
              description="Njofton raundet, përgjigjet kur e thërret me @AI, dhe në fund bën një përmbledhje."
            />
          </div>

          <div className="mt-3 rounded-[10px] border border-line bg-sunken p-3">
            <p className="text-[12.5px] font-medium text-ink">Çfarë sheh AI</p>
            <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] leading-relaxed text-muted">
              <li>• Nëse je i lidhur me hapësirën</li>
              <li>• Nëse skeda është e hapur dhe ka pasur ndërveprim</li>
              <li>• Pjesëmarrjen në raunde dhe atë që shkruan në chat</li>
            </ul>
            <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
              Asnjëherë kamerën, mikrofonin apo fytyrën. Nuk ka njohje fytyre
              dhe nuk ka ndjekje të shikimit.
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-[10px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}
        </StepCard>
      )}

      <div className="mt-5 flex justify-between">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? router.push("/mso-bashke") : setStep(step - 1))}
        >
          {step === 0 ? "Anulo" : "Prapa"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Vazhdo
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button disabled={busy} onClick={create}>
            {busy ? "Po krijoj…" : "Krijo hapësirën"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className="mt-1 text-[13px] text-muted">{hint}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </Card>
  );
}

function PrivacyOption({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors",
        active ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"
      )}
    >
      <span className={cx("mt-0.5", active ? "text-brand" : "text-muted")}>
        {icon}
      </span>
      <span>
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted">{body}</span>
      </span>
    </button>
  );
}
