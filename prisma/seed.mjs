/**
 * Development seed — optional, never run automatically.
 *
 *   npm run db:seed
 *
 * Creates one demo account so a fresh clone has something to look at. Real
 * users always start with an empty account; nothing here is attached to
 * accounts created through sign-up.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/index.js";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

const EMAIL = "demo@hajdemsojna.app";
const PASSWORD = "demo12345";

function iso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const SUBJECTS = [
  {
    name: "Algoritme",
    short: "ALG",
    tone: 0,
    teacher: "Prof. Dr. Blerim Rexha",
    room: "Salla 301",
    difficulty: 5,
    importance: 5,
    targetGrade: 9,
    topics: [
      ["Kompleksiteti dhe Big O", 3],
      ["Rekursioni", 3],
      ["Algoritmet e renditjes", 2],
      ["Pemët dhe BST", 1],
      ["Grafet — BFS / DFS", 1],
      ["Programimi dinamik", 0],
    ],
  },
  {
    name: "Baza të Dhënave",
    short: "DB",
    tone: 2,
    teacher: "Prof. Asoc. Lirim Bytyqi",
    room: "Salla 204",
    difficulty: 4,
    importance: 4,
    targetGrade: 9,
    topics: [
      ["Modeli relacional", 3],
      ["SQL bazik — SELECT", 3],
      ["SQL Joins", 1],
      ["Normalizimi 1NF–3NF", 1],
      ["Transaksionet & ACID", 0],
    ],
  },
  {
    name: "Zhvillim Ueb",
    short: "WEB",
    tone: 1,
    teacher: "Doc. Arta Krasniqi",
    room: "Lab 2",
    difficulty: 3,
    importance: 4,
    targetGrade: 10,
    topics: [
      ["HTML semantik", 3],
      ["CSS Layout", 3],
      ["JavaScript modern", 2],
      ["Komponentët në React", 2],
      ["Fetch & REST API", 1],
    ],
  },
];

const LECTURES = [
  [0, 0, "09:00", "10:30", "ligjerate", "Salla 301"],
  [1, 0, "11:00", "12:30", "ligjerate", "Salla 204"],
  [2, 1, "10:00", "11:30", "lab", "Lab 2"],
  [0, 2, "09:00", "10:30", "ushtrime", "Salla 301"],
  [1, 3, "12:00", "13:30", "ligjerate", "Salla 204"],
  [2, 4, "10:00", "11:30", "ligjerate", "Lab 2"],
];

async function main() {
  await db.user.deleteMany({ where: { email: EMAIL } });

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "Erti",
      surname: "Hoxha",
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      profile: {
        create: {
          learnerType: "universitet",
          institution: "Universiteti i Prishtinës — FIEK",
          year: "Viti 2",
          onboardedAt: new Date(),
        },
      },
      settings: { create: {} },
      preference: {
        create: { sessionLength: 45, breakLength: 15, maxMinutesPerDay: 180, freeDays: "6" },
      },
    },
  });

  const subjectIds = [];
  for (const s of SUBJECTS) {
    const created = await db.subject.create({
      data: {
        userId: user.id,
        name: s.name,
        short: s.short,
        tone: s.tone,
        teacher: s.teacher,
        room: s.room,
        difficulty: s.difficulty,
        importance: s.importance,
        targetGrade: s.targetGrade,
        topics: {
          create: s.topics.map(([name, mastery], i) => ({
            name,
            mastery,
            minutes: mastery * 40,
            position: i,
          })),
        },
      },
    });
    subjectIds.push(created.id);
  }

  for (const [si, day, start, end, kind, room] of LECTURES) {
    await db.lecture.create({
      data: { userId: user.id, subjectId: subjectIds[si], day, start, end, kind, room },
    });
  }

  for (const day of [0, 1, 2, 3, 4]) {
    await db.availability.create({
      data: { userId: user.id, day, fromTime: "17:00", toTime: "21:00" },
    });
  }

  await db.assignment.create({
    data: {
      userId: user.id,
      subjectId: subjectIds[2],
      title: "Projekti i Web-it — Faza 2",
      detail: "Ndërfaqja me React dhe integrimi me REST API.",
      due: iso(2),
      progress: 70,
      estMinutes: 240,
      steps: {
        create: [
          { label: "Dizajni i komponentëve", done: true, position: 0 },
          { label: "Lidhja me API-në", done: true, position: 1 },
          { label: "Autentikimi", done: false, position: 2 },
        ],
      },
    },
  });

  await db.assignment.create({
    data: {
      userId: user.id,
      subjectId: subjectIds[1],
      title: "Detyra 3 — Normalizimi & Joins",
      detail: "Normalizo skemën deri në 3NF dhe shkruaj 8 query.",
      due: iso(4),
      progress: 20,
      estMinutes: 150,
      steps: { create: [{ label: "Analiza e skemës", done: true, position: 0 }] },
    },
  });

  const algoTopics = await db.topic.findMany({ where: { subjectId: subjectIds[0] } });
  await db.exam.create({
    data: {
      userId: user.id,
      subjectId: subjectIds[0],
      title: "Kolokviumi i parë",
      kind: "kolokvium",
      date: iso(8),
      start: "10:00",
      room: "Amfiteatri A",
      targetGrade: 9,
      studiedMinutes: 380,
      topics: { create: algoTopics.map((t) => ({ topicId: t.id })) },
    },
  });

  const grades = [
    [0, "kuiz", "Kuizi 1 — Big O", 9, 0.1, 26],
    [0, "detyre", "Detyra 1", 8, 0.1, 19],
    [1, "kuiz", "Kuizi 1 — SQL", 7.5, 0.1, 18],
    [2, "projekt", "Projekti — Faza 1", 10, 0.25, 12],
  ];
  for (const [si, kind, title, value, weight, daysAgo] of grades) {
    await db.grade.create({
      data: {
        userId: user.id,
        subjectId: subjectIds[si],
        kind,
        title,
        value,
        weight,
        date: iso(-daysAgo),
      },
    });
  }

  // Keep Subject.currentGrade consistent with the grades above.
  for (const subjectId of subjectIds) {
    const rows = await db.grade.findMany({ where: { subjectId } });
    if (!rows.length) continue;
    const weight = rows.reduce((s, g) => s + g.weight, 0) || 1;
    const earned = rows.reduce((s, g) => s + g.value * g.weight, 0);
    await db.subject.update({
      where: { id: subjectId },
      data: { currentGrade: Math.round((earned / weight) * 10) / 10 },
    });
  }

  for (const key of ["kaloj-provimet", "permiresoj-notat", "mesoj-rregullisht"]) {
    await db.studyGoal.create({ data: { userId: user.id, key } });
  }

  // A little completed history so progress charts have something to show.
  const history = [
    [-9, 0, "Algoritmet e renditjes", "17:00", 45],
    [-7, 1, "SQL bazik — SELECT", "19:00", 45],
    [-5, 0, "Pemët dhe BST", "18:15", 45],
    [-3, 2, "Komponentët në React", "18:00", 50],
    [-1, 0, "Grafet — BFS / DFS", "17:00", 45],
  ];
  for (const [offset, si, title, start, minutes] of history) {
    await db.studySession.create({
      data: {
        userId: user.id,
        subjectId: subjectIds[si],
        kind: "mesim",
        title,
        date: iso(offset),
        start,
        minutes,
        status: "done",
        understanding: 4,
        rating: 3,
      },
    });
  }

  // ── Flashcards, at three different stages of being learned ───────────
  //
  // A demo deck where every card is new would make the review screen look
  // like a to-do list. These are spread across new, learning and mature so
  // the strength figure and the intervals mean something on first open.
  const CARDS = [
    [0, "Çfarë është kompleksiteti O(n log n)?", "Rritje pak më e shpejtë se lineare — tipike për renditjen me krahasim.", 0, 0],
    [0, "Kur është e dobishme tabela hash?", "Kur duhet kërkim, futje dhe fshirje afërsisht në kohë konstante.", 6, 2],
    [0, "Dallimi mes BFS dhe DFS?", "BFS shkon nivel pas niveli, DFS ndjek një degë deri në fund.", 34, 5],
    [1, "Çfarë mat derivati?", "Shpejtësinë e ndryshimit të funksionit në një pikë.", 0, 0],
    [1, "Kur ekziston limiti i një funksioni?", "Kur limiti nga e majta dhe nga e djathta janë të barabartë.", 12, 3],
    [2, "Çfarë është normalizimi 3NF?", "Çdo atribut jo-çelës varet vetëm nga çelësi primar.", 0, 0],
    [2, "Për çfarë shërben indeksi në bazë të dhënash?", "Për ta bërë kërkimin të shpejtë, me koston e shkrimeve pak më të ngadalta.", 21, 4],
  ];

  for (const [si, front, back, intervalDays, repetitions] of CARDS) {
    await db.flashcard.create({
      data: {
        userId: user.id,
        subjectId: subjectIds[si],
        front,
        back,
        source: "manual",
        // A new card is due today; a scheduled one is spread across the
        // interval it earned, so they do not all come back on the same day.
        due: iso(intervalDays === 0 ? 0 : Math.floor(intervalDays / 3)),
        intervalDays,
        repetitions,
        easeFactor: 2.5,
      },
    });
  }

  // ── One finished quiz, so readiness has real recall to work from ─────
  const QUIZ = [
    ["Cila strukturë jep kërkim O(1) mesatarisht?", ["Lista e lidhur", "Tabela hash", "Pema binare", "Vargu i renditur"], 1, 1],
    ["Sa është kompleksiteti i renditjes me bashkim?", ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], 1, 1],
    ["Çfarë përdor BFS për të mbajtur nyjet?", ["Stek", "Radhë", "Grumbull", "Hartë"], 1, 0],
  ];

  await db.quizAttempt.create({
    data: {
      userId: user.id,
      subjectId: subjectIds[0],
      source: "ai",
      total: QUIZ.length,
      correct: QUIZ.filter(([, , correct, chosen]) => correct === chosen).length,
      seconds: 145,
      date: iso(-2),
      answers: {
        create: QUIZ.map(([question, options, correctIndex, chosenIndex], position) => ({
          question,
          options: JSON.stringify(options),
          correctIndex,
          chosenIndex,
          correct: correctIndex === chosenIndex,
          position,
        })),
      },
    },
  });

  console.log(`Seed gati.\n  Email:      ${EMAIL}\n  Fjalëkalimi: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
