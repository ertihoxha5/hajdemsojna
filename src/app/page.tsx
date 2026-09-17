import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Lock,
  Play,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { Wordmark } from "@/components/brand";
import { LandingNav } from "@/components/landing/nav";
import { Reveal } from "@/components/landing/reveal";
import {
  DashboardPreview,
  GroupMini,
  MaterialsMini,
  ProgressMini,
  ScheduleMini,
  StudyRoomPreview,
  TasksMini,
  TutorMini,
} from "@/components/landing/mockups";

export const metadata: Metadata = {
  title: "Hajde Msojna — Mëso më zgjuar me AI",
  description:
    "Orari, detyrat, provimet dhe progresi yt — të organizuara automatikisht. Asistenti AI që njeh orarin tënd dhe ndërton planin e studimit.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas">
      <LandingNav signedIn={!!user} />

      <Hero signedIn={!!user} />
      <HowItWorks />
      <Features />
      <AISection />
      <GroupSection />
      <Security />
      <FinalCTA signedIn={!!user} />
      <Footer />
    </div>
  );
}

/* ============================================================
   Hero
   ============================================================ */

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative pt-28 sm:pt-32">
      {/* ambient colour, kept faint */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-brand/12" />
        <div className="blob absolute right-0 top-40 h-[380px] w-[380px] rounded-full bg-mint/12" />
      </div>

      <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-24">
        <div>
          <span className="anim-in inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-brand">
            <Sparkles size={12} />
            AI Study Assistant
          </span>

          <h1 className="anim-in anim-delay-1 mt-5 text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[52px]">
            Mëso më zgjuar <span className="text-mint-deep">me AI.</span>
          </h1>

          <p className="anim-in anim-delay-2 mt-4 max-w-xl text-[17px] font-medium leading-snug text-ink sm:text-[19px]">
            Orari, detyrat, provimet dhe progresi yt — të organizuara automatikisht.
          </p>

          <p className="anim-in anim-delay-3 mt-3.5 max-w-xl text-[15px] leading-relaxed text-muted">
            Hajde Msojna të ndihmon të organizosh ligjëratat, vetë-mësimin, detyrat, afatet dhe
            grupet e studimit. AI krijon një plan të personalizuar sipas orarit dhe progresit tënd.
          </p>

          <div className="anim-in anim-delay-4 mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={signedIn ? "/sot" : "/signup"}
              className="inline-flex h-12 items-center gap-2 rounded-[11px] bg-brand px-6 text-[15.5px] font-medium text-white shadow-[0_2px_8px_rgba(64,56,206,0.28)] transition-all hover:bg-brand-deep active:scale-[0.99]"
            >
              {signedIn ? "Hap aplikacionin" : "Fillo falas"}
              <ArrowRight size={17} />
            </Link>
            <a
              href="#si-funksionon"
              className="inline-flex h-12 items-center gap-2 rounded-[11px] border border-line bg-surface px-5 text-[15.5px] font-medium text-ink transition-colors hover:bg-sunken"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Play size={11} fill="currentColor" />
              </span>
              Shiko si funksionon
            </a>
          </div>

          <div className="anim-in anim-delay-5 mt-7 flex flex-wrap gap-2">
            {["Study Planner", "AI Tutor", "Group Study", "Progress Tracker"].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted"
              >
                <Check size={11} className="text-mint-deep" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="anim-in anim-delay-3 float-slow lg:pl-4">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   How it works
   ============================================================ */

const STEPS = [
  {
    n: "01",
    title: "Shto orarin",
    body: "Shto lëndët, ligjëratat dhe kohën kur je i lirë për të mësuar.",
    icon: Calendar,
  },
  {
    n: "02",
    title: "Shto detyrat dhe provimet",
    body: "Afatet, kolokviumet dhe provimet që të presin këtë semestër.",
    icon: ListChecks,
  },
  {
    n: "03",
    title: "AI krijon planin",
    body: "AI peshon urgjencën, vështirësinë dhe kohën tënde, pastaj ndërton javën.",
    icon: Sparkles,
  },
  {
    n: "04",
    title: "Mëso dhe përcjell progresin",
    body: "Ndjek planin, shëno çfarë kuptove, dhe plani rregullohet vetë.",
    icon: TrendingUp,
  },
];

function HowItWorks() {
  return (
    <section id="si-funksionon" className="scroll-mt-20 border-y border-line bg-surface py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand">
            Si funksionon
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
            Nga orari në progres, në 4 hapa.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="group relative h-full rounded-[14px] border border-line bg-canvas p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between">
                  <span className="num text-[12px] font-semibold text-faint">{s.n}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                    <s.icon size={17} />
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{s.body}</p>

                {i < STEPS.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="absolute -right-[11px] top-1/2 hidden -translate-y-1/2 text-line lg:block"
                  />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Features
   ============================================================ */

const FEATURES = [
  {
    title: "Orari Inteligjent",
    body: "Shto lëndët dhe orarin tënd, dhe lejo AI ta organizojë ditën në mënyrën më të mirë.",
    icon: Calendar,
    preview: <ScheduleMini />,
  },
  {
    title: "Detyrat & Provimet",
    body: "Mos harro asnjë afat. Merr njoftime inteligjente dhe planifiko në kohë.",
    icon: ListChecks,
    preview: <TasksMini />,
  },
  {
    title: "AI Tutor",
    body: "Merr shpjegime të qarta, krijo kuize, përmbledh materiale dhe zgjidh ushtrime me AI.",
    icon: Sparkles,
    preview: <TutorMini />,
  },
  {
    title: "Mso Bashkë",
    body: "Krijo ose bashkohu në grupe studimi, mëso së bashku dhe qëndro i motivuar.",
    icon: Users,
    preview: <GroupMini />,
  },
  {
    title: "Progresi & Notat",
    body: "Ndjek progresin tënd, ruaj notat dhe shiko ku po përmirësohesh me kalimin e kohës.",
    icon: TrendingUp,
    preview: <ProgressMini />,
  },
  {
    title: "Materialet & PDF",
    body: "Ngarko dhe përmbledh PDF, merr shënime inteligjente dhe gjej shpejt atë që të duhet.",
    icon: FileText,
    preview: <MaterialsMini />,
  },
];

function Features() {
  return (
    <section id="vecorite" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand">
            Veçoritë kryesore
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
            Gjithçka që të duhet për një përvojë më të mirë studentore.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="flex h-full flex-col rounded-[14px] border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                    <f.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[11px] border border-line bg-surface p-3">
                  {f.preview}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   AI assistant
   ============================================================ */

const AI_CAN = [
  "Shpjego koncepte",
  "Përmblidh PDF",
  "Gjenero quiz",
  "Gjenero flashcards",
  "Planifiko javën",
  "Analizo progresin",
  "Përgatit plan për provim",
];

function AISection() {
  return (
    <section id="ai" className="scroll-mt-20 border-y border-line bg-surface py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand">
              Asistenti AI
            </p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
              Asistenti yt personal <span className="text-mint-deep">për mësim.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Pyet, mëso, përmblidh dhe planifiko — gjithçka në një vend. Asistenti njeh lëndët,
              orarin, detyrat dhe provimet e tua, dhe të ndihmon t&apos;i kuptosh temat, jo thjesht
              t&apos;i kopjosh.
            </p>

            <ul className="mt-6 flex flex-col gap-2.5">
              {AI_CAN.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px] text-ink">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-soft text-mint-deep">
                    <Check size={11} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-[12px] border border-line bg-canvas p-4">
              <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                <Server size={13} className="text-brand" />
                Funksionon me çelësin e serverit ose me çelësin tënd
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Anthropic, OpenAI ose Google Gemini. Çelësi ruhet i enkriptuar dhe nuk del kurrë
                në shfletues.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <AIConversation />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AIConversation() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-canvas shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai-soft text-ai">
          <Sparkles size={14} />
        </span>
        <div>
          <p className="text-[13.5px] font-medium text-ink">Hajde Msojna AI</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Online · Gati për të ndihmuar
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="ml-auto max-w-[80%] rounded-[12px] rounded-br-[4px] bg-brand px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
          Ma shpjego recursion në programim.
        </div>

        <div className="flex gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai">
            <Sparkles size={13} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed text-ink">
              Rekursioni është kur një funksion e thërret vetveten mbi një problem më të vogël. I
              duhen dy pjesë: një <em>rast bazë</em> që e ndal, dhe një hap që e zvogëlon problemin
              drejt tij.
            </p>
            <pre className="mt-2.5 overflow-x-auto rounded-[9px] border border-line bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-ink">
{`def faktorial(n):
    if n == 0:        # rasti bazë
        return 1
    return n * faktorial(n - 1)`}
            </pre>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">
              Tani provo ti: si do ta shkruaje shumën nga 1 deri te n?
            </p>
          </div>
        </div>

        <div className="ml-auto max-w-[80%] rounded-[12px] rounded-br-[4px] bg-brand px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
          Më bëj 5 pyetje.
        </div>

        <div className="flex gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai">
            <Sparkles size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] text-ink">Ja një kuiz i shkurtër:</p>
            <div className="mt-2 overflow-hidden rounded-[10px] border border-line bg-surface">
              <div className="border-b border-line px-3 py-2 text-[12.5px] font-medium text-ink">
                Kuiz · 5 pyetje
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[12.5px] font-medium text-ink">
                  <span className="num mr-1.5 text-faint">1.</span>
                  Çfarë i mungon një funksioni rekursiv që bie në pafundësi?
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {["Hapi rekursiv", "Rasti bazë", "Vlera kthyese"].map((o, i) => (
                    <span
                      key={o}
                      className={`rounded-[7px] border px-2.5 py-1.5 text-[12px] ${
                        i === 1 ? "border-ok bg-ok-soft text-ok" : "border-line text-muted"
                      }`}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Group study
   ============================================================ */

function GroupSection() {
  return (
    <section id="mso-bashke" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand">
              Mso Bashkë
            </p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
              Mëso së bashku, <span className="text-mint-deep">arrini më shumë.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Krijo ose bashkohu në dhoma studimi me shokët e tu. Diskutoni, ndani materiale,
              përdorni AI në grup dhe qëndroni të motivuar. Studimi është më i lehtë kur nuk je
              vetëm.
            </p>

            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {[
                "Chat në kohë reale",
                "Timer i përbashkët",
                "Ndarje materialesh",
                "AI në çdo dhomë",
                "Kuize për grupin",
                "Ftesa me kod",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px] text-ink">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-soft text-mint-deep">
                    <Check size={11} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[14.5px] font-medium text-white transition-colors hover:bg-brand-deep"
            >
              Hap një dhomë studimi
              <ArrowRight size={15} />
            </Link>
          </Reveal>

          <Reveal delay={100}>
            <StudyRoomPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Security
   ============================================================ */

const SECURITY = [
  {
    icon: Lock,
    title: "Kyçje e sigurt",
    body: "Fjalëkalimet ruhen si hash bcrypt — kurrë si tekst i thjeshtë.",
  },
  {
    icon: ShieldCheck,
    title: "API Key i enkriptuar",
    body: "Çelësi yt API ruhet i enkriptuar me AES-256-GCM dhe përdoret vetëm nga serveri.",
  },
  {
    icon: Layers,
    title: "Privatësi e të dhënave",
    body: "Çdo rresht i përket llogarisë tënde. Asnjë student tjetër nuk i sheh.",
  },
  {
    icon: Settings,
    title: "Ti ke kontrollin",
    body: "Zgjedh ofruesin e AI, ndrysho ose fshij çelësin, ose fshij llogarinë në çdo kohë.",
  },
];

function Security() {
  return (
    <section id="studente" className="scroll-mt-20 border-y border-line bg-surface py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand">
            I sigurt dhe në kontroll tënd
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map((s, i) => (
            <Reveal key={s.title} delay={i * 70}>
              <div className="h-full rounded-[14px] border border-line bg-canvas p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-mint-soft text-mint-deep">
                  <s.icon size={17} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Final CTA + footer
   ============================================================ */

function FinalCTA({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[18px] border border-line bg-surface px-6 py-12 text-center sm:px-12">
            <div className="blob absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand/12" />
            <div className="blob absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-mint/12" />

            <div className="relative">
              <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
                Gati të fillosh?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
                Krijo llogarinë, shto orarin tënd dhe lëre AI-n ta ndërtojë javën e parë të
                studimit. Falas, pa kartë krediti.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href={signedIn ? "/sot" : "/signup"}
                  className="inline-flex h-12 items-center gap-2 rounded-[11px] bg-brand px-6 text-[15.5px] font-medium text-white shadow-[0_2px_8px_rgba(64,56,206,0.28)] transition-colors hover:bg-brand-deep"
                >
                  {signedIn ? "Hap aplikacionin" : "Fillo falas"}
                  <ArrowRight size={17} />
                </Link>
                {!signedIn && (
                  <Link
                    href="/signin"
                    className="inline-flex h-12 items-center rounded-[11px] border border-line bg-canvas px-6 text-[15.5px] font-medium text-ink transition-colors hover:bg-sunken"
                  >
                    Kyçu
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER = [
  {
    title: "Produkti",
    links: [
      { label: "Si funksionon", href: "#si-funksionon" },
      { label: "Veçoritë", href: "#vecorite" },
      { label: "AI Asistenti", href: "#ai" },
      { label: "Mso Bashkë", href: "#mso-bashke" },
    ],
  },
  {
    title: "Fillo",
    links: [
      { label: "Regjistrohu", href: "/signup" },
      { label: "Kyçu", href: "/signin" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-12">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Wordmark size={30} />
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-muted">
              Hajde Msojna është asistenti yt me AI për një përvojë më të mirë studentore.
              Organizohu. Mëso. Arrit më shumë.
            </p>
          </div>

          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-semibold text-ink">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] text-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <p className="text-[12.5px] text-faint">
            © {new Date().getFullYear()} Hajde Msojna. Të gjitha të drejtat e rezervuara.
          </p>
          <p className="flex items-center gap-1.5 text-[12.5px] text-faint">
            <BookOpen size={12} />
            Ndërtuar për studentët
            <GraduationCap size={12} />
          </p>
        </div>
      </div>
    </footer>
  );
}
