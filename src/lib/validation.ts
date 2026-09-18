import { z } from "zod";

/**
 * Every value that crosses a trust boundary — form posts, API bodies, and
 * anything the model returns — is parsed here before it reaches the database.
 * The schema stores these unions as plain strings for portability, so this file
 * is what actually enforces them.
 */

/* ── Primitives ──────────────────────────────────────────── */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data duhet të jetë në formatin VVVV-MM-DD");

export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ora duhet të jetë në formatin HH:MM");

export const dayIndex = z.number().int().min(0).max(6);

export const masteryLevel = z.number().int().min(0).max(3);

export const learnerType = z.enum(["universitet", "shkolle", "bootcamp", "vetemesim"]);
export const lectureKind = z.enum(["ligjerate", "ushtrime", "lab", "seminar"]);
export const sessionKind = z.enum([
  "mesim",
  "perseritje",
  "detyre",
  "pushim",
  "grup",
  "provim-prep",
]);
export const sessionStatus = z.enum(["planned", "done", "missed", "skipped"]);
export const examKind = z.enum(["kolokvium", "final", "provim"]);
export const gradeKind = z.enum([
  "kuiz",
  "detyre",
  "gjysmefinal",
  "final",
  "projekt",
  "pjesemarrje",
]);
export const materialKind = z.enum(["pdf", "ppt", "link", "foto", "dok", "txt"]);
export const goalKey = z.enum([
  "kaloj-provimet",
  "permiresoj-notat",
  "mesoj-rregullisht",
  "matura",
  "afati",
  "detyrat-me-kohe",
]);
export const aiProviderKey = z.enum(["anthropic", "openai", "google", "groq"]);
export const aiCreativity = z.enum(["low", "balanced", "creative"]);

/* ── Auth ────────────────────────────────────────────────── */

export const passwordSchema = z
  .string()
  .min(8, "Fjalëkalimi duhet të ketë të paktën 8 karaktere")
  .max(200, "Fjalëkalimi është shumë i gjatë")
  .regex(/[a-zA-Z]/, "Fjalëkalimi duhet të përmbajë të paktën një shkronjë")
  .regex(/[0-9]/, "Fjalëkalimi duhet të përmbajë të paktën një numër");

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Shkruaj emrin tënd").max(60),
    surname: z.string().trim().min(2, "Shkruaj mbiemrin tënd").max(60),
    email: z.string().trim().toLowerCase().email("Email-i nuk është valid"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Fjalëkalimet nuk përputhen",
    path: ["confirm"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email-i nuk është valid"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Linku nuk është valid"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Fjalëkalimet nuk përputhen",
    path: ["confirm"],
  });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email-i nuk është valid"),
  password: z.string().min(1, "Shkruaj fjalëkalimin"),
  remember: z.boolean().optional(),
});

/* ── Academics ───────────────────────────────────────────── */

export const subjectInput = z.object({
  name: z.string().trim().min(1, "Emri i lëndës mungon").max(120),
  short: z.string().trim().max(8).optional(),
  teacher: z.string().trim().max(120).optional(),
  room: z.string().trim().max(60).optional(),
  tone: z.number().int().min(0).max(4).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  targetGrade: z.number().min(1).max(10).optional(),
  currentGrade: z.number().min(0).max(10).optional(),
  credits: z.number().int().min(0).max(60).optional(),
});

export const topicInput = z.object({
  subjectId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
});

export const lectureInput = z.object({
  subjectId: z.string().min(1),
  day: dayIndex,
  start: clockTime,
  end: clockTime,
  kind: lectureKind.default("ligjerate"),
  room: z.string().trim().max(60).optional(),
});

export const assignmentInput = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1, "Titulli mungon").max(200),
  detail: z.string().trim().max(2000).optional(),
  due: isoDate,
  estMinutes: z.number().int().min(5).max(6000).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  steps: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

export const examInput = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1, "Titulli mungon").max(200),
  kind: examKind.default("kolokvium"),
  date: isoDate,
  start: clockTime.default("09:00"),
  room: z.string().trim().max(60).optional(),
  targetGrade: z.number().min(1).max(10).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  notes: z.string().trim().max(2000).optional(),
  topicIds: z.array(z.string()).optional(),
});

export const gradeInput = z.object({
  subjectId: z.string().min(1),
  kind: gradeKind,
  title: z.string().trim().min(1).max(200),
  value: z.number().min(1).max(10),
  /// Percentage in the UI, stored as a 0..1 share
  weight: z.number().min(0).max(100),
  date: isoDate.optional(),
});

export const sessionInput = z.object({
  subjectId: z.string().min(1).nullable().optional(),
  kind: sessionKind.default("mesim"),
  title: z.string().trim().min(1).max(200),
  objective: z.string().trim().max(400).optional(),
  date: isoDate,
  start: clockTime,
  minutes: z.number().int().min(5).max(480),
  why: z.string().trim().max(400).optional(),
  linkedId: z.string().nullable().optional(),
});

export const sessionFinishInput = z.object({
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(4).nullable().optional(),
  understanding: z.number().int().min(1).max(5).nullable().optional(),
  actualMinutes: z.number().int().min(0).max(600).optional(),
});

export const noteInput = z.object({
  id: z.string().optional(),
  subjectId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20000).optional(),
  pinned: z.boolean().optional(),
});

export const availabilityInput = z.object({
  windows: z
    .array(z.object({ day: dayIndex, from: clockTime, to: clockTime }))
    .max(21),
  sessionLength: z.number().int().min(15).max(180).optional(),
  breakLength: z.number().int().min(0).max(60).optional(),
  maxMinutesPerDay: z.number().int().min(15).max(720).optional(),
  rhythm: z.enum(["mengjes", "mbremje", "fleksibil"]).optional(),
  freeDays: z.array(dayIndex).max(7).optional(),
});

/* ── Onboarding ──────────────────────────────────────────── */

export const onboardingInput = z.object({
  learnerType,
  institution: z.string().trim().max(160).optional(),
  year: z.string().trim().max(40).optional(),
  subjects: z.array(subjectInput).min(1, "Shto të paktën një lëndë").max(20),
  lectures: z
    .array(
      z.object({
        subjectIndex: z.number().int().min(0),
        day: dayIndex,
        start: clockTime,
        end: clockTime,
        kind: lectureKind,
        room: z.string().trim().max(60).optional(),
      })
    )
    .max(80),
  exams: z
    .array(
      z.object({
        subjectIndex: z.number().int().min(0),
        title: z.string().trim().min(1).max(200),
        date: isoDate,
        start: clockTime.optional(),
      })
    )
    .max(40),
  availability: availabilityInput,
  goals: z.array(goalKey).max(6),
});

/* ── AI ──────────────────────────────────────────────────── */

export const aiSettingsInput = z.object({
  provider: aiProviderKey.nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  creativity: aiCreativity.optional(),
  language: z.enum(["sq", "en"]).optional(),
});

export const aiKeyInput = z.object({
  provider: aiProviderKey,
  apiKey: z.string().trim().min(10, "Çelësi duket i pavlefshëm").max(400),
});

export const aiChatInput = z.object({
  message: z.string().trim().min(1, "Shkruaj një pyetje").max(4000),
  conversationId: z.string().nullable().optional(),
});

/**
 * The shape the model must return for a study plan. Anything that fails this
 * is rejected before it can reach the database — the model never writes rows
 * directly.
 */
export const aiStudyPlanSchema = z.object({
  sessions: z
    .array(
      z.object({
        subjectId: z.string().min(1),
        topic: z.string().trim().min(1).max(160),
        date: isoDate,
        startTime: clockTime,
        duration: z.number().int().min(15).max(180),
        reason: z.string().trim().max(300).default(""),
        kind: sessionKind.optional(),
      })
    )
    .max(60),
  summary: z.string().trim().max(600).optional(),
});

export type AIStudyPlan = z.infer<typeof aiStudyPlanSchema>;

export const aiQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        q: z.string().trim().min(1).max(500),
        options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
        answer: z.number().int().min(0).max(5),
        hint: z.string().trim().max(300).default(""),
      })
    )
    .min(1)
    .max(20),
})
  .refine((v) => v.questions.every((q) => q.answer < q.options.length), {
    message: "Indeksi i përgjigjes është jashtë intervalit",
  });

export type AIQuiz = z.infer<typeof aiQuizSchema>;

/**
 * Flashcards the model returns. Kept deliberately tight: a card whose front is
 * a paragraph is not a flashcard, and the length caps are what stop the model
 * from drifting into summaries.
 */
export const aiFlashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(1).max(300),
        back: z.string().trim().min(1).max(600),
        topic: z.string().trim().max(120).default(""),
      })
    )
    .min(1)
    .max(30),
});

export type AIFlashcards = z.infer<typeof aiFlashcardsSchema>;

/* ── Recall: flashcards and quiz attempts ────────────────── */

export const recallGrade = z.enum(["nuk-e-dita", "veshtire", "mire", "lehte"]);

export const flashcardInput = z.object({
  front: z.string().trim().min(1, "Pyetja mungon").max(300),
  back: z.string().trim().min(1, "Përgjigjja mungon").max(600),
  subjectId: z.string().min(1).nullable().optional(),
  topicId: z.string().min(1).nullable().optional(),
});

export const flashcardReviewInput = z.object({
  cardId: z.string().min(1),
  recall: recallGrade,
});

export const flashcardGenerateInput = z.object({
  subjectId: z.string().min(1),
  topicIds: z.array(z.string()).max(30).optional(),
  materialId: z.string().min(1).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

export const quizAttemptInput = z.object({
  subjectId: z.string().min(1).nullable().optional(),
  materialId: z.string().min(1).nullable().optional(),
  source: z.enum(["ai", "material"]).default("ai"),
  seconds: z.number().int().min(0).max(86_400).default(0),
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        options: z.array(z.string().trim().max(300)).min(2).max(6),
        correctIndex: z.number().int().min(0).max(5),
        /** -1 means the student skipped it. */
        chosenIndex: z.number().int().min(-1).max(5),
        explanation: z.string().trim().max(300).default(""),
        topicName: z.string().trim().max(120).default(""),
      })
    )
    .min(1)
    .max(30),
});

export const aiRescheduleSchema = z.object({
  date: isoDate,
  startTime: clockTime,
  reason: z.string().trim().max(300).default(""),
});

/* ── Groups ──────────────────────────────────────────────── */

export const groupInput = z.object({
  name: z.string().trim().min(2, "Emri i grupit mungon").max(80),
  subjectId: z.string().nullable().optional(),
  about: z.string().trim().max(500).optional(),
});

export const groupMessageInput = z.object({
  text: z.string().trim().min(1).max(2000),
});

/* ── Helpers ─────────────────────────────────────────────── */

/** Turns a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
