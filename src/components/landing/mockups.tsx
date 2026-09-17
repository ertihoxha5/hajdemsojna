import {
  ArrowUp,
  Calendar,
  Check,
  FileText,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";

/**
 * Miniature interfaces used across the landing page.
 *
 * These are static renderings of real screens in the product — same type
 * scale, same tokens, same layout — rather than illustrations, so what the
 * page promises is what the app actually looks like.
 */

const SUBJECT_TONES = ["#5a54f3", "#0f9488", "#c2740a", "#d0456c", "#a21caf"];

/* ── Hero: the dashboard inside a browser frame ─────────── */

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--shadow-lg)]">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-3.5 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="mx-auto rounded-md bg-surface px-3 py-0.5 text-[10.5px] text-faint">
          hajdemsojna.app/sot
        </span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-[132px] shrink-0 flex-col gap-0.5 border-r border-line p-2.5 sm:flex">
          {[
            { label: "Sot", icon: Calendar, on: true },
            { label: "Orari", icon: Calendar },
            { label: "Detyrat", icon: Check },
            { label: "Provimet", icon: GraduationCap },
            { label: "Mso Bashkë", icon: Users },
            { label: "AI Tutor", icon: Sparkles },
          ].map((i) => (
            <span
              key={i.label}
              className={`flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-[11px] ${
                i.on ? "bg-brand-soft font-medium text-brand" : "text-muted"
              }`}
            >
              <i.icon size={12} />
              {i.label}
            </span>
          ))}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 p-4">
          <p className="text-[11px] text-faint">E enjte, 17 Shtator</p>
          <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.02em] text-ink">
            Mirëdita, Erti.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { n: "2", l: "ligjërata" },
              { n: "2", l: "sesione" },
              { n: "1", l: "detyrë" },
            ].map((s) => (
              <div key={s.l} className="rounded-[9px] border border-line px-2.5 py-2">
                <p className="num text-[15px] font-semibold leading-none text-ink">{s.n}</p>
                <p className="mt-1 text-[10px] text-muted">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-[10px] border border-ai/25 bg-ai-soft/50 p-2.5">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ai">
              <Sparkles size={10} />
              Rekomandim i AI
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink">
              Ke provim në Algoritme pas 8 ditësh. Të kam planifikuar një sesion shtesë për
              sonte.
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {[
              { t: "13:00", n: "Algoritme", s: "Ligjëratë · Salla 301", c: 0 },
              { t: "17:30", n: "SQL Joins", s: "Databaza · 45 min", c: 2 },
              { t: "19:00", n: "Algoritme Crew", s: "Grup · 45 min", c: 1 },
            ].map((r) => (
              <div
                key={r.t}
                className="flex items-center gap-2.5 rounded-[9px] border border-line px-2.5 py-2"
              >
                <span className="num w-8 text-[10px] font-medium text-muted">{r.t}</span>
                <span
                  className="h-6 w-[2.5px] rounded-full"
                  style={{ background: SUBJECT_TONES[r.c] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium text-ink">{r.n}</span>
                  <span className="block truncate text-[10px] text-muted">{r.s}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature tiles ───────────────────────────────────────── */

export function ScheduleMini() {
  return (
    <div className="flex flex-col gap-1.5">
      {[
        { t: "10:00", n: "Algoritme", r: "Salla B1", c: 0 },
        { t: "12:00", n: "Baza të Dhënave", r: "Salla C3", c: 2 },
        { t: "16:00", n: "Zhvillim Ueb", r: "Online", c: 1 },
      ].map((r) => (
        <div key={r.t} className="flex items-center gap-2.5 rounded-[8px] bg-canvas px-2.5 py-2">
          <span className="num w-9 text-[10.5px] font-medium text-muted">{r.t}</span>
          <span className="h-5 w-[2.5px] rounded-full" style={{ background: SUBJECT_TONES[r.c] }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-medium text-ink">{r.n}</span>
            <span className="block text-[10px] text-faint">{r.r}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function TasksMini() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2 rounded-[8px] bg-canvas px-2.5 py-2">
        <span className="mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-ok text-white">
          <Check size={9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-ink">Detyrë — Algoritme</span>
          <span className="block text-[10px] text-faint">Afati: 12 Tetor</span>
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-[8px] bg-canvas px-2.5 py-2">
        <span className="mt-0.5 h-3.5 w-3.5 rounded-[4px] border-2 border-bad" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-ink">Provim — Baza të Dhënave</span>
          <span className="block text-[10px] text-faint">Afati: 25 Tetor</span>
        </span>
      </div>
    </div>
  );
}

export function TutorMini() {
  return (
    <div className="flex flex-col gap-2">
      <div className="ml-auto max-w-[85%] rounded-[9px] rounded-br-[3px] bg-brand px-2.5 py-1.5 text-[11px] text-white">
        Ma shpjego këtë koncept…
      </div>
      <div className="flex items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5 py-2">
        <Sparkles size={12} className="shrink-0 text-ai" />
        <span className="caret text-[11px] text-muted">Po shkruaj</span>
        <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white">
          <ArrowUp size={11} />
        </span>
      </div>
    </div>
  );
}

export function ProgressMini() {
  return (
    <div className="flex flex-col gap-2">
      {[
        { n: "Algoritme", v: 92, c: 0 },
        { n: "Baza të Dhënave", v: 78, c: 2 },
        { n: "Zhvillim Ueb", v: 88, c: 1 },
      ].map((r) => (
        <div key={r.n}>
          <div className="flex items-baseline justify-between text-[10.5px]">
            <span className="text-ink">{r.n}</span>
            <span className="num text-faint">{r.v}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.v}%`, background: SUBJECT_TONES[r.c] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MaterialsMini() {
  return (
    <div className="flex flex-col gap-1.5">
      {["Kapitulli 1 — Hyrje.pdf", "Shënime — Algoritme.pdf", "Ushtrime — DB.pdf"].map((f) => (
        <div key={f} className="flex items-center gap-2 rounded-[8px] bg-canvas px-2.5 py-2">
          <FileText size={12} className="shrink-0 text-bad" />
          <span className="truncate text-[11px] text-ink">{f}</span>
        </div>
      ))}
    </div>
  );
}

export function GroupMini() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {[0, 3, 1, 4].map((t, i) => (
            <span
              key={i}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--surface)]"
              style={{ background: SUBJECT_TONES[t] }}
            >
              {["E", "A", "L", "D"][i]}
            </span>
          ))}
        </div>
        <span className="text-[10.5px] text-muted">+3</span>
      </div>
      <div className="rounded-[8px] bg-canvas px-2.5 py-2">
        <p className="text-[11.5px] font-medium text-ink">Grupi — Algoritme</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          5 anëtarë · Online
        </p>
      </div>
    </div>
  );
}

/* ── Group study room (dark) ─────────────────────────────── */

export function StudyRoomPreview() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#2a2a36] bg-[#15151d] shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2.5 border-b border-[#2a2a36] px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2a2a3a] text-[#8b86ff]">
          <Users size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">Dhomë Studimi — Algoritme</p>
          <p className="text-[11px] text-[#8c8ca0]">5 anëtarë online</p>
        </div>
        <div className="hidden gap-1 sm:flex">
          {["Chat", "Anëtarët", "AI Tutor"].map((t, i) => (
            <span
              key={t}
              className={`rounded-[7px] px-2.5 py-1 text-[11px] ${
                i === 0 ? "bg-[#2a2a3a] text-white" : "text-[#8c8ca0]"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.1fr]">
        {/* timer */}
        <div className="flex flex-col items-center justify-center rounded-[12px] bg-[#1c1c26] px-4 py-6">
          <div className="flex -space-x-2">
            {[0, 3, 1].map((t, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-[#1c1c26]"
                style={{ background: SUBJECT_TONES[t] }}
              >
                {["A", "B", "L"][i]}
              </span>
            ))}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a3a] text-[10px] font-semibold text-[#c9c9d6] ring-2 ring-[#1c1c26]">
              +1
            </span>
          </div>

          <p className="num mt-5 text-[38px] font-semibold leading-none tracking-[-0.03em] text-white">
            25:00
          </p>
          <p className="mt-1.5 text-[11px] text-[#8c8ca0]">Fokus Mode</p>

          <div className="mt-5 flex gap-1.5">
            <span className="rounded-[8px] bg-mint px-3.5 py-1.5 text-[11.5px] font-medium text-[#08211c]">
              Start
            </span>
            <span className="rounded-[8px] bg-[#2a2a3a] px-3.5 py-1.5 text-[11.5px] text-[#c9c9d6]">
              Pauzë
            </span>
            <span className="rounded-[8px] bg-[#2a2a3a] px-3.5 py-1.5 text-[11.5px] text-[#c9c9d6]">
              Rivendos
            </span>
          </div>
        </div>

        {/* chat */}
        <div className="flex flex-col gap-2.5">
          {[
            { n: "Arben", t: "10:24", m: "Kush e ka kuptuar ushtrimin 3?", c: 3 },
            { n: "Besa", t: "10:25", m: "Unë e kam, e ndaj screenin.", c: 1 },
          ].map((msg) => (
            <div key={msg.n} className="flex gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold text-white"
                style={{ background: SUBJECT_TONES[msg.c] }}
              >
                {msg.n[0]}
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] text-[#8c8ca0]">
                  {msg.n} <span className="num">{msg.t}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#e4e4ee]">{msg.m}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2a2a3a] text-[#8b86ff]">
              <Sparkles size={11} />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] text-[#8b86ff]">
                AI Tutor <span className="num text-[#8c8ca0]">10:26</span>
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#e4e4ee]">
                Ja një shpjegim i shkurtër për ushtrimin 3…
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 rounded-[9px] bg-[#1c1c26] px-3 py-2">
            <span className="flex-1 text-[11px] text-[#6e6e82]">Shkruaj një mesazh…</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5a54f3] text-white">
              <ArrowUp size={11} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
