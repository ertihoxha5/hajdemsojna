"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Key,
  Server,
  Shield,
  Sparkles,
  Trash,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Thinking,
  cx,
  useToast,
} from "@/components/ui";

type ProviderKey = "anthropic" | "openai" | "google" | "groq";

interface Settings {
  provider: ProviderKey | null;
  model: string | null;
  creativity: "low" | "balanced" | "creative";
  language: "sq" | "en";
  hasOwnKey: boolean;
  keyLast4: string | null;
  serverProviders: ProviderKey[];
  canStoreKeys: boolean;
  labels: Record<ProviderKey, string>;
  defaultModels: Record<ProviderKey, string>;
}

const CREATIVITY: { key: Settings["creativity"]; label: string; body: string }[] = [
  { key: "low", label: "E ulët", body: "Përgjigje të shkurtra dhe të drejtpërdrejta" },
  { key: "balanced", label: "E balancuar", body: "Sjellja e parazgjedhur" },
  { key: "creative", label: "Krijuese", body: "Më shumë shembuj dhe alternativa" },
];

export default function AISettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; message: string; provider: string; model: string; source: string } | { ok: false; message: string } | null
  >(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        setSettings(await res.json());
      } catch {
        setLoadError("Cilësimet nuk u ngarkuan. Rifresko faqen.");
      }
    })();
  }, []);

  async function patch(update: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...update };
    setSettings(next);

    const res = await fetch("/api/ai/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: next.provider,
        model: next.model,
        creativity: next.creativity,
        language: next.language,
      }),
    });

    if (res.ok) toast("Cilësimet u ruajtën.");
    else toast("Ruajtja dështoi.");
  }

  async function saveKey() {
    if (!settings?.provider) {
      setKeyError("Zgjedh së pari ofruesin.");
      return;
    }
    setSavingKey(true);
    setKeyError(null);

    try {
      const res = await fetch("/api/ai/key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: settings.provider, apiKey: apiKey.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setKeyError(data.error ?? "Ruajtja e çelësit dështoi.");
        return;
      }

      setSettings({ ...settings, hasOwnKey: true, keyLast4: data.keyLast4 });
      setApiKey("");
      toast("Çelësi u ruajt i enkriptuar.");
    } catch {
      setKeyError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setSavingKey(false);
    }
  }

  async function removeKey() {
    const res = await fetch("/api/ai/key", { method: "DELETE" });
    if (res.ok && settings) {
      setSettings({ ...settings, hasOwnKey: false, keyLast4: null });
      toast("Çelësi u fshi.");
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setTestResult(
        res.ok
          ? {
              ok: true,
              message: data.message ?? "Lidhja me AI funksionon.",
              provider: data.provider,
              model: data.model,
              source: data.source,
            }
          : { ok: false, message: data.error ?? "Testi dështoi." }
      );
    } catch {
      setTestResult({ ok: false, message: "Lidhja dështoi. Kontrollo internetin." });
    } finally {
      setTesting(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="AI Asistenti" />
        <Card className="border-bad/30 bg-bad-soft">
          <p className="text-[13.5px] text-bad">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="AI Asistenti" />
        <Card>
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton mt-3 h-4 w-64 rounded" />
        </Card>
      </div>
    );
  }

  const serverHasAny = settings.serverProviders.length > 0;
  const effective = settings.provider ?? settings.serverProviders[0] ?? null;

  return (
    <div>
      <Link
        href="/cilesimet"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Cilësimet
      </Link>

      <PageHeader
        title="AI Asistenti"
        question="Cili model përgjigjet dhe me çfarë çelësi?"
        right={
          <Button variant="primary" onClick={testConnection} disabled={testing}>
            <Sparkles size={14} />
            {testing ? "Duke testuar…" : "Testo AI"}
          </Button>
        }
      />

      {/* ── Connection status ────────────────────────── */}
      {!serverHasAny && !settings.hasOwnKey && (
        <Card className="mb-4 border-warn/30 bg-warn-soft/50">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="text-[14px] font-medium text-ink">AI nuk është konfiguruar ende</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Serveri nuk ka asnjë çelës të vendosur. Shto çelësin tënd më poshtë, ose kërko nga
                administratori ta vendosë në variablat e mjedisit.
              </p>
            </div>
          </div>
        </Card>
      )}

      {testing && (
        <Card className="mb-4">
          <Thinking label="Po dërgoj një kërkesë testuese te modeli…" />
        </Card>
      )}

      {testResult && (
        <Card
          className={cx(
            "anim-in mb-4",
            testResult.ok ? "border-ok/30 bg-ok-soft/50" : "border-bad/30 bg-bad-soft"
          )}
        >
          <div className="flex items-start gap-3">
            {testResult.ok ? (
              <Check size={16} className="mt-0.5 shrink-0 text-ok" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-bad" />
            )}
            <div>
              <p className={cx("text-[14px] font-medium", testResult.ok ? "text-ok" : "text-bad")}>
                {testResult.message}
              </p>
              {testResult.ok && (
                <p className="mt-1 text-[12.5px] text-muted">
                  {settings.labels[testResult.provider as ProviderKey] ?? testResult.provider} ·{" "}
                  {testResult.model} · çelësi{" "}
                  {testResult.source === "user" ? "yti" : "i serverit"}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Provider ─────────────────────────────── */}
        <Card>
          <h2 className="text-[15px] font-semibold text-ink">Ofruesi</h2>
          <p className="mt-1 text-[13px] text-muted">
            Zgjedh cili model përgjigjet. Të gjitha kërkesat kalojnë përmes serverit.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {(["anthropic", "openai", "groq", "google"] as ProviderKey[]).map((p) => {
              const onServer = settings.serverProviders.includes(p);
              const active = effective === p;
              return (
                <button
                  key={p}
                  onClick={() => patch({ provider: p })}
                  className={cx(
                    "flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors",
                    active ? "border-brand bg-brand-soft" : "border-line hover:bg-sunken"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      active ? "border-brand bg-brand text-white" : "border-line"
                    )}
                  >
                    {active && <Check size={10} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">
                      {settings.labels[p]}
                    </span>
                    <span className="block text-[12px] text-faint">
                      {settings.defaultModels[p]}
                    </span>
                  </span>
                  {onServer && <Badge tone="ok">Gati</Badge>}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Field label="Modeli" hint="Lëre bosh për parazgjedhjen">
              <Input
                value={settings.model ?? ""}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                onBlur={() => patch({ model: settings.model || null })}
                placeholder={effective ? settings.defaultModels[effective] : "—"}
              />
            </Field>
          </div>
        </Card>

        {/* ── Behaviour ────────────────────────────── */}
        <Card>
          <h2 className="text-[15px] font-semibold text-ink">Sjellja</h2>

          <p className="mb-2 mt-4 text-[12.5px] font-medium text-muted">Kreativiteti</p>
          <div className="flex flex-col gap-2">
            {CREATIVITY.map((c) => (
              <button
                key={c.key}
                onClick={() => patch({ creativity: c.key })}
                className={cx(
                  "rounded-[10px] border px-3.5 py-2.5 text-left transition-colors",
                  settings.creativity === c.key
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:bg-sunken"
                )}
              >
                <span className="block text-[13.5px] font-medium text-ink">{c.label}</span>
                <span className="block text-[12px] text-muted">{c.body}</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Field label="Gjuha e përgjigjeve">
              <Select
                value={settings.language}
                onChange={(e) => patch({ language: e.target.value as "sq" | "en" })}
              >
                <option value="sq">Shqip</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
        </Card>

        {/* ── Bring your own key ───────────────────── */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <Key size={15} className="text-muted" />
            <h2 className="text-[15px] font-semibold text-ink">Çelësi yt API</h2>
            {settings.hasOwnKey && <Badge tone="ok">I ruajtur</Badge>}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Opsionale. Nëse shton çelësin tënd, ai përdoret në vend të çelësit të serverit. Ruhet i
            enkriptuar me AES-256-GCM dhe nuk kthehet kurrë në shfletues.
          </p>

          {!settings.canStoreKeys && (
            <p className="mt-3 rounded-[9px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              Ky server nuk ka APP_ENCRYPTION_KEY, ndaj ruajtja e çelësave është e çaktivizuar.
            </p>
          )}

          {settings.hasOwnKey ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="num rounded-[9px] border border-line bg-canvas px-3.5 py-2 text-[14px] text-ink">
                {"•".repeat(12)}
                {settings.keyLast4}
              </span>
              <Button onClick={() => setSettings({ ...settings, hasOwnKey: false })}>
                Ndrysho
              </Button>
              <Button variant="danger" onClick={removeKey}>
                <Trash size={13} />
                Fshije
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              {keyError && (
                <p className="mb-2 rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
                  {keyError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[260px] flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    className="pr-11"
                    disabled={!settings.canStoreKeys}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    aria-label={showKey ? "Fshihe" : "Shfaq"}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-faint hover:text-muted"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  variant="primary"
                  onClick={saveKey}
                  disabled={savingKey || !apiKey.trim() || !settings.canStoreKeys}
                >
                  {savingKey ? "Duke ruajtur…" : "Ruaj çelësin"}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Server size={15} className="mt-0.5 shrink-0 text-mint-deep" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Çdo kërkesë shkon shfletues → server → ofrues. Çelësi nuk del kurrë në kodin e
                frontend-it.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Shield size={15} className="mt-0.5 shrink-0 text-mint-deep" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Shfletuesi sheh vetëm katër shifrat e fundit. Mund ta fshish në çdo moment.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
