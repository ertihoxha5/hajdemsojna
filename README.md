# Hajde Msojna

**Mëso më zgjuar me AI.**

An AI study assistant for university, high-school and bootcamp students. Each
student signs up, enters their subjects, timetable, deadlines and free hours,
and the app builds — and keeps adjusting — a personal study plan. The interface
is entirely in Albanian.

## Running it

```bash
npm install
npm run db:migrate      # creates the database from prisma/schema.prisma
npm run dev             # http://localhost:3000

npm run db:seed         # optional demo account (see below)
npm run build
npm run lint
```

Environment lives in two files: `DATABASE_URL` in `.env` (the Prisma CLI reads
that one), everything else in `.env.local`. `.env.example` lists the keys.

### Turning the AI on

Everything except the AI features works with no configuration. To enable the
assistant, put **one** of these in `.env.local` and restart:

```bash
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GROQ_API_KEY="gsk_..."                    # OpenAI-compatible, has a free tier
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

The app auto-detects whichever is present, preferring them in the order above.
Groq is served through the OpenAI SDK against its own base URL and speaks Chat
Completions, so it has its own adapter; the default model is
`openai/gpt-oss-120b`. If your Groq account exposes a different lineup, set the
model in **Cilësimet → AI**. Until then, AI actions return a
plain Albanian "not configured" message rather than pretending to work.

Students can optionally supply their own key in **Cilësimet → AI**. It is
encrypted with AES-256-GCM using `APP_ENCRYPTION_KEY` (generated for you on
first setup) and only its last four characters are ever sent back to the
browser.

### Demo account

`npm run db:seed` creates one account with a realistic semester:

```
demo@hajdemsojna.app / demo12345
```

It is opt-in and development-only. Accounts created through sign-up always
start empty — no demo data is ever attached to a real user.

## Architecture

| Path | What lives there |
|---|---|
| `prisma/schema.prisma` | The data model. Portable: no DB-specific enums or JSON |
| `src/proxy.ts` | Optimistic route protection (Next 16 renamed middleware to proxy) |
| `src/lib/session.ts` | Server-side sessions, bcrypt passwords |
| `src/lib/crypto.ts` | AES-256-GCM for user-supplied AI keys |
| `src/lib/validation.ts` | Every Zod schema — forms, API bodies, and model output |
| `src/lib/ai/` | Provider abstraction, context engine, prompts, tasks |
| `src/lib/planner.ts` | The deterministic planner: priority scoring and slot filling |
| `src/lib/insights.ts` | Computed summaries (not model output — labelled as such) |
| `src/server/` | Data access, all of it user-scoped |
| `src/app/(app)/` | The authenticated screens |

### Authentication

Sign-up and sign-in are server actions. Passwords are bcrypt hashes (cost 12);
the plaintext is never stored or logged. A session is a row in the database and
an opaque random token in an httpOnly cookie — no user data in the cookie, and
signing out deletes the row, so the session is genuinely revoked.

`src/proxy.ts` redirects signed-out visitors, but it is only a fast first pass:
it cannot reach the database. The real boundary is the data layer, where every
query and mutation resolves the user from the session cookie and filters by
that id. A forged id in a request body matches nothing.

### The AI layer

```
Browser → Next route handler → AIProvider → Anthropic / OpenAI / Groq / Gemini
```

Keys never leave the server. `AIProvider` (`src/lib/ai/types.ts`) is the only
thing application code depends on, so switching providers is a settings change.

**Context is built, not dumped.** `buildStudentContext` selects only the rows
that bear on the question and pre-computes the numbers (readiness, remaining
minutes, weighted averages) in code. The model reasons and explains; it never
does arithmetic the app can do exactly.

**Model output is never trusted.** Study plans come back as structured JSON,
are parsed with Zod, and are then checked against reality — the student's own
subject ids, their free windows, their lectures, their daily cap. Anything that
doesn't fit is dropped and reported, so a hallucinated slot cannot reach the
timetable.

**Nothing is simulated.** There is no canned fallback anywhere. When the model
is unreachable the UI says so in Albanian.

### Learning, not answering

Asked to just do a graded assignment, the assistant declines and opens with the
first step instead — a question back, a worked analogue, a hint. This holds in
the tutor chat, in focus mode, and inside study groups.

### Group study

Rooms are real: create one, share the six-character invite code, and members
join. The live feed is Server-Sent Events — the server holds the connection and
pushes new messages and presence as they appear, reconnecting automatically.
Mentioning `@AI` calls the model server-side and stores its reply as a normal
group message, so everyone sees it and it survives a reload.

## Moving to PostgreSQL

The schema avoids anything SQLite-specific, so production is three steps:

1. `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at your server
3. Swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in
   `src/lib/db.ts`

Nothing above that file changes.
