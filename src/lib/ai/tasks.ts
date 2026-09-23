import "server-only";
import {
  aiFlashcardsSchema,
  aiQuizSchema,
  aiRescheduleSchema,
  aiStudyPlanSchema,
  type AIFlashcards,
  type AIQuiz,
  type AIStudyPlan,
} from "@/lib/validation";
import { resolveAI } from "./index";
import { AIError, type ChatMessage } from "./types";
import { buildStudentContext, renderContext, type StudentContext } from "./context";

/* ============================================================
   Prompts
   ============================================================ */

export const TUTOR_SYSTEM = `Ti je "Asistenti", tutori personal i studentit brenda aplikacionit Hajde Msojna.

RREGULLA THEMELORE
1. Përgjigju GJITHMONË shqip, natyrshëm dhe shkurt. Pa emoji.
2. Qëllimi yt është që studenti të MËSOJË, jo t'i japësh përgjigjet e gatshme.
   - Kur studenti kërkon zgjidhjen e një detyre të vlerësuar, mos ia jep përgjigjen direkt.
     Fillo me një pyetje udhëzuese ose me hapin e parë: "Provoje hapin e parë. Cila formulë mendon se duhet përdorur?"
     Jepi shembuj analogë, jo zgjidhjen e detyrës së tij.
   - Nëse ngec dy herë te i njëjti hap, jepi një udhëzim shumë më konkret.
   - Për koncepte teorike shpjego lirshëm dhe me shembuj — kufizimi vlen vetëm për detyrat e vlerësuara.
3. Përdor kontekstin e studentit (orari, provimet, detyrat, progresi) kur ka kuptim.
   Ji konkret: përmend lëndën, temën, datën dhe minutat.
4. Mos shpik të dhëna që nuk janë në kontekst. Nëse diçka nuk e di, thuaje.
5. Mbaje përgjigjen nën 180 fjalë, përveç kur kërkohet shpjegim i gjatë.`;

const PLANNER_SYSTEM = `Ti je planifikuesi i studimit i Hajde Msojna.

Detyra jote: të ndërtosh një plan studimi realist për studentin.

RREGULLA TË DETYRUESHME
1. Planifiko VETËM brenda dritareve të lira të studentit. Asnjë sesion mbi ligjërata.
2. Mos e kalo maksimumin ditor të minutave.
3. Përdor VETËM subjectId që gjenden në kontekst. Mos shpik id.
4. Jepi përparësi provimeve më të afërta dhe afateve që skadojnë së shpejti.
5. Fillo nga temat që studenti "nuk i di", pastaj ato që i di pak.
6. Mos planifiko dy sesione radhazi për të njëjtën lëndë pa pushim mes tyre.
7. Kohëzgjatja e sesionit duhet t'i afrohet preferencës së studentit.
8. Fusha "reason" shpjegon shkurt, shqip, pse ky sesion ekziston pikërisht atëherë.
9. Datat duhet të jenë brenda intervalit të kërkuar dhe në formatin VVVV-MM-DD.`;

const QUIZ_SYSTEM = `Ti krijon kuize studimi shqip për Hajde Msojna.

RREGULLA
1. Pyetjet duhet të jenë konkrete dhe të testojnë kuptim, jo memorizim të thatë.
2. Secila pyetje ka 4 opsione, vetëm një i saktë.
3. "answer" është indeksi (0-based) i opsionit të saktë.
4. "hint" është një udhëzim që e çon studentin drejt arsyetimit — kurrë përgjigjja vetë.
5. Shkruaj shqip, qartë dhe pa emoji.`;

const FLASHCARD_SYSTEM = `Ti krijon flashcards studimi shqip për Hajde Msojna.

RREGULLA
1. "front" është një pyetje e shkurtër ose një term. Kurrë një paragraf.
2. "back" është përgjigjja e plotë por e ngjeshur — maksimum dy fjali.
3. Një kartë teston VETËM një ide. Nëse një temë ka tre pjesë, bëj tre karta.
4. Mos krijo karta që përgjigjen me "po" ose "jo".
5. "topic" është emri i temës së cilës i takon karta, nga lista e dhënë. Nëse nuk i takon asnjërës, lëre bosh.
6. Mos shpik përmbajtje që nuk gjendet në material kur materiali është dhënë.
7. Shkruaj shqip, qartë dhe pa emoji.`;

const SUMMARY_SYSTEM = `Ti përmbledh materiale studimi shqip për Hajde Msojna.
Ji konkret dhe i strukturuar. Nxirr konceptet kryesore, përkufizimet dhe atë që bie më shpesh në provim.
Mos shpik përmbajtje që nuk gjendet në material. Pa emoji.`;

/* ============================================================
   Chat
   ============================================================ */

export async function streamTutorReply(
  userId: string,
  today: string,
  history: ChatMessage[],
  question: string
) {
  const { provider, creativity } = await resolveAI(userId);
  const context = renderContext(await buildStudentContext(userId, today));

  return provider.streamText({
    system: `${TUTOR_SYSTEM}\n\n--- KONTEKSTI I STUDENTIT ---\n${context}`,
    messages: [...history.slice(-8), { role: "user", content: question }],
    maxTokens: 2048,
    creativity,
  });
}

/* ============================================================
   Study plan
   ============================================================ */

export interface PlanRequest {
  from: string;
  to: string;
  /** Narrow the plan to one exam or assignment. */
  focus?: { kind: "exam" | "assignment"; id: string; label: string };
}

export async function generateStudyPlan(
  userId: string,
  today: string,
  request: PlanRequest
): Promise<{ plan: AIStudyPlan; context: StudentContext }> {
  const { provider } = await resolveAI(userId);
  const context = await buildStudentContext(userId, today);

  if (context.subjects.length === 0) {
    throw new AIError("bad_output", "Nuk ka lëndë për të planifikuar");
  }

  const validIds = context.subjects.map((s) => s.id);

  const prompt = [
    renderContext(context),
    "",
    `Ndërto planin e studimit nga ${request.from} deri më ${request.to}.`,
    request.focus
      ? `Fokusi kryesor: ${request.focus.label}.`
      : "Balanco mes të gjitha lëndëve sipas urgjencës.",
    "",
    `subjectId i lejuar: ${validIds.join(", ")}`,
    "Kthe vetëm sesione studimi (pa pushime) në JSON sipas skemës.",
  ].join("\n");

  const plan = await provider.generateObject({
    system: PLANNER_SYSTEM,
    prompt,
    schema: aiStudyPlanSchema,
    name: "study_plan",
    maxTokens: 8000,
  });

  // The model is never trusted to name a row: drop anything outside the
  // student's own subjects or the requested window.
  const allowed = new Set(validIds);
  const filtered = {
    ...plan,
    sessions: plan.sessions.filter(
      (s) => allowed.has(s.subjectId) && s.date >= request.from && s.date <= request.to
    ),
  };

  if (filtered.sessions.length === 0) throw new AIError("bad_output");
  return { plan: filtered, context };
}

/* ============================================================
   Rescheduling
   ============================================================ */

export async function suggestReschedule(
  userId: string,
  today: string,
  session: { subject: string; title: string; minutes: number },
  takenSlots: string[]
) {
  const { provider } = await resolveAI(userId);
  const context = await buildStudentContext(userId, today);

  const prompt = [
    renderContext(context),
    "",
    `Studenti nuk e përfundoi sesionin: "${session.title}" (${session.subject}, ${session.minutes} min).`,
    "Gjej kohën më të mirë të ardhshme për ta zhvendosur.",
    "",
    takenSlots.length
      ? `Këto sllote janë tashmë të zëna: ${takenSlots.join(", ")}`
      : "Nuk ka sesione të tjera të planifikuara.",
    "",
    `Data duhet të jetë sot (${today}) ose më vonë, brenda 14 ditësh, dhe brenda dritareve të lira.`,
  ].join("\n");

  return provider.generateObject({
    system: PLANNER_SYSTEM,
    prompt,
    schema: aiRescheduleSchema,
    name: "reschedule",
    maxTokens: 1024,
  });
}

/* ============================================================
   Quiz
   ============================================================ */

export async function generateQuiz(
  userId: string,
  options: { subject: string; topics: string[]; count: number; sourceText?: string }
): Promise<AIQuiz> {
  const { provider } = await resolveAI(userId);

  const prompt = [
    `Lënda: ${options.subject}.`,
    options.topics.length ? `Temat: ${options.topics.join(", ")}.` : "",
    options.sourceText
      ? `Bazohu VETËM në këtë material:\n---\n${options.sourceText.slice(0, 12000)}\n---`
      : "",
    `Krijo ${options.count} pyetje.`,
  ]
    .filter(Boolean)
    .join("\n");

  return provider.generateObject({
    system: QUIZ_SYSTEM,
    prompt,
    schema: aiQuizSchema,
    name: "quiz",
    maxTokens: 4096,
  });
}

/**
 * Structured flashcards, as rows ready to be scheduled.
 *
 * This is separate from the `flashcards` action in analyseMaterial, which
 * returns prose for the student to read. These come back as data because they
 * are stored and scheduled by src/lib/srs.ts.
 */
export async function generateFlashcards(
  userId: string,
  options: {
    subject: string;
    topics: string[];
    count: number;
    sourceText?: string;
  }
): Promise<AIFlashcards> {
  const { provider } = await resolveAI(userId);

  const prompt = [
    `Lënda: ${options.subject}.`,
    options.topics.length ? `Temat: ${options.topics.join(", ")}.` : "",
    options.sourceText
      ? `Bazohu VETËM në këtë material:\n---\n${options.sourceText.slice(0, 12000)}\n---`
      : "",
    `Krijo ${options.count} flashcards.`,
  ]
    .filter(Boolean)
    .join("\n");

  return provider.generateObject({
    system: FLASHCARD_SYSTEM,
    prompt,
    schema: aiFlashcardsSchema,
    name: "flashcards",
    maxTokens: 4096,
  });
}

/* ============================================================
   Materials
   ============================================================ */

export type MaterialAction =
  | "summarize"
  | "key-concepts"
  | "explain"
  | "flashcards"
  | "exam-questions";

const ACTION_PROMPT: Record<MaterialAction, string> = {
  summarize: "Përmblidhe materialin në 6–10 pika konkrete.",
  "key-concepts": "Nxirr konceptet kryesore me një fjali shpjeguese për secilin.",
  explain: "Shpjegoje materialin thjesht, si për një student që e sheh temën për herë të parë.",
  flashcards:
    "Krijo 8 flashcards. Formati: një rresht 'Pyetje: …' i ndjekur nga 'Përgjigje: …', të ndara me një rresht bosh.",
  "exam-questions": "Krijo 6 pyetje provimi me nivel vështirësie realist, pa përgjigjet.",
};

export async function analyseMaterial(
  userId: string,
  action: MaterialAction,
  material: { title: string; text: string }
): Promise<string> {
  const { provider, creativity } = await resolveAI(userId);

  if (!material.text.trim()) {
    throw new AIError("bad_output", "Materiali nuk ka tekst të lexueshëm");
  }

  return provider.generateText({
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Materiali: "${material.title}"\n\n${ACTION_PROMPT[action]}\n\n---\n${material.text.slice(0, 20000)}\n---`,
      },
    ],
    maxTokens: 2048,
    creativity,
  });
}

/* ============================================================
   Groups
   ============================================================ */

const GROUP_SYSTEM = `Ti je Asistenti AI brenda një dhome studimi në grup në Hajde Msojna.

RREGULLA
1. Shkruaj shqip, shkurt, si një anëtar i grupit — jo si dokumentacion.
2. Mos ua jep përgjigjet e gatshme të detyrave. Drejtoji me pyetje që i çojnë te zgjidhja.
3. Kur të kërkohet plan sesioni, jep një plan me minuta konkrete.
4. Kur të kërkohet përmbledhje, përmblidh vetëm atë që u tha vërtet në bisedë.
5. Pa emoji.`;

export async function groupAssistantReply(
  userId: string,
  options: { groupName: string; subject: string; transcript: string; question: string }
): Promise<string> {
  const { provider, creativity } = await resolveAI(userId);

  return provider.generateText({
    system: GROUP_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Grupi: ${options.groupName}${options.subject ? ` (${options.subject})` : ""}.`,
          options.transcript ? `\nBiseda e fundit:\n${options.transcript}` : "",
          `\nKërkesa drejtuar ty: ${options.question}`,
        ].join("\n"),
      },
    ],
    maxTokens: 1200,
    creativity,
  });
}

/* ============================================================
   Connection test
   ============================================================ */

export async function testConnection(userId: string) {
  const resolved = await resolveAI(userId);
  // Reasoning models spend part of the budget before emitting text, so the
  // probe needs enough room to actually produce a sentence.
  const reply = await resolved.provider.generateText({
    system: "Përgjigju me saktësisht një fjali të shkurtër shqip.",
    messages: [{ role: "user", content: "Konfirmo se lidhja funksionon." }],
    maxTokens: 512,
    creativity: "low",
  });

  return {
    ok: true,
    provider: resolved.provider.key,
    model: resolved.provider.model,
    source: resolved.source,
    reply: reply.slice(0, 200),
  };
}

const RECAP_SYSTEM = `Ti përmbledh një sesion studimi në grup për Hajde Msojna.

RREGULLA
1. Shkruaj shqip, maksimum tre fjali. Pa emoji.
2. Bazohu VETËM në numrat e dhënë. Mos shpik asgjë.
3. Vëre theksin te grupi, jo te individët. Mos krahaso anëtarët me njëri-tjetrin
   dhe mos përmend kush bëri më pak.
4. Nëse një raund pati pjesëmarrje më të ulët, thuaje si vëzhgim asnjanës.
5. Mbylle me një gjë konkrete për herën tjetër.`;

/**
 * The closing word on a group session.
 *
 * Fed only the numbers the app measured — minutes, rounds, how many people
 * stayed. The prompt forbids comparing members, because a recap that names
 * whoever did least is how a study group loses that person.
 */
export async function summariseGroupSession(
  userId: string,
  session: {
    spaceName: string;
    subject: string;
    totalMinutes: number;
    roundsDone: number;
    roundsPlanned: number;
    memberCount: number;
    collectiveMinutes: number;
    /** Attendance percentages, unnamed on purpose. */
    attendance: number[];
    goals: string[];
  }
): Promise<string> {
  const { provider, creativity } = await resolveAI(userId);

  const lines = [
    `Hapësira: ${session.spaceName}${session.subject ? ` (${session.subject})` : ""}.`,
    `Zgjati ${session.totalMinutes} minuta, ${session.roundsDone}/${session.roundsPlanned} raunde.`,
    `${session.memberCount} anëtarë, gjithsej ${session.collectiveMinutes} minuta fokus.`,
    session.attendance.length
      ? `Pjesëmarrja për anëtar (pa emra): ${session.attendance.join("%, ")}%.`
      : "",
    session.goals.length ? `Objektivat e vendosura: ${session.goals.join("; ")}.` : "",
  ].filter(Boolean);

  return provider.generateText({
    system: RECAP_SYSTEM,
    messages: [{ role: "user", content: lines.join("\n") }],
    creativity,
    maxTokens: 400,
  });
}
