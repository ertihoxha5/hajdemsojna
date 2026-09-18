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
npm run typecheck
npm test                # node --test, no test dependencies
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

`npm run db:seed` creates one account with a realistic semester — subjects,
a timetable, deadlines, grades, a flashcard deck part-way through being
learned, and a quiz already sat:

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
| `src/lib/srs.ts` | Spaced repetition (SM-2). Pure, no I/O |
| `src/lib/pomodoro.ts` | Splits a session into work and break phases |
| `src/lib/rate-limit.ts` | Per-user budgets for the routes that cost money |
| `src/lib/password-reset.ts` | Reset tokens, hashed at rest |
| `src/lib/email-verify.ts` | Address confirmation, same table, separate scope |
| `src/server/reminders.ts` | Deadline and exam notifications |
| `src/server/export.ts` | Account export and .ics calendar |
| `src/lib/insights.ts` | Computed summaries (not model output — labelled as such) |
| `src/server/` | Data access, all of it user-scoped |
| `src/app/(app)/` | The authenticated screens |

### Not implemented

Sign-in is email and password only. The schema carries an `Account` model for
OAuth and `.env.example` lists the Google keys, but nothing reads them — the
gap is left visible there rather than left to be discovered.

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

### Recall: flashcards and quizzes

Cards are scheduled by `src/lib/srs.ts`, an SM-2 implementation that is a pure
function of the card's state and one answer — so the next due date is always
reproducible, and the review buttons can show the student exactly what each
choice costs before they press it. Two deliberate departures from the 1988
paper: forgetting a card resets its interval but not the ease factor it earned,
and intervals are capped at 180 days, because a card due after the exam was
never studied.

Quiz attempts are stored rather than thrown away, and recent accuracy feeds
into exam readiness — marking a topic "e zotëroj" is a claim, answering
questions about it is evidence. A subject with no attempts keeps the original
weighting exactly, so never quizzing is neither rewarded nor punished.

### Passwords and email

Reset tokens are stored as SHA-256 hashes; the plaintext exists only in the
link. They are single-use, expire after an hour, and using one revokes every
other session — a reset is how a student recovers a compromised account.

Signing up sends a confirmation link, but an unconfirmed address is never a
gate: a student who signed up to plan tomorrow's revision should not be locked
out because a mail is slow. It only means we will not send them anything
important, and Cilësimet says so with a button to send the link again.

Both flows share the `VerificationToken` table and are kept apart by a scope
prefix, so a confirmation link can never be spent as a password reset. There
are tests for both directions, because that particular mix-up would be an
account takeover.

There is no mail provider wired up by default. `src/lib/mail.ts` reports
honestly which of two things happened: `sent`, or `logged` to the server
console. The UI says which, rather than claiming an email is on its way. Set
`RESEND_API_KEY` to turn on real delivery.

### Rate limiting

Every `/api/ai/*` route passes through `src/lib/rate-limit.ts` first, because a
signed-in student calling one in a loop spends the server's API budget. Limits
are per user and per action — a tutor reply and a whole-semester study plan do
not cost the same. State is in-process, which is exactly as durable as the SSE
connections in the group routes; running more than one instance means moving
the map to Redis, and nothing outside that file changes.

### Taking the data out

`/api/account/export` returns everything the student made as one JSON file, and
`/api/calendar` returns the timetable as `.ics`. The export deliberately omits
the password hash, session tokens and the encrypted AI key — those are
credentials, not data. There is a test that fails if any of them ever appear.

### Tests

`npm test` runs on Node's built-in test runner and native TypeScript stripping,
so there is no test framework, no transpiler and no new dependency. Two things
the Next bundler provides are supplied by `tests/resolver.mjs` instead: the
`@/…` path alias and extensionless relative imports, plus a stub for the
`server-only` marker package. Tests therefore import the code that actually
ships, rather than a copy that can drift.

Suites that touch the database run against the real one and clean up after
themselves; they are namespaced by email domain and the runner is serial,
because one SQLite file cannot serve parallel test processes.

### Focus mode

A session is split into work and break blocks by `src/lib/pomodoro.ts`, using
the rhythm the student set in Cilësimet. Before this the preference existed but
focus mode ignored it and ran one long countdown. The split never ends on a
break, and the total work time always equals the session the planner
scheduled — there is a test for that, because losing fifteen minutes to a
rounding error is the kind of bug nobody reports.

### Reminders

`src/server/reminders.ts` writes notifications for deadlines within two days
and exams within three. It runs on state load rather than on a scheduler,
because this app has no background worker: the student's own visit is the
trigger, which is also the only moment they could act on the reminder. It is
idempotent by construction, so running it on every load cannot produce
duplicates.

### Group study

Rooms are real: create one, share the six-character invite code, and members
join. The live feed is Server-Sent Events — the server holds the connection and
pushes new messages and presence as they appear, reconnecting automatically.
Mentioning `@AI` calls the model server-side and stores its reply as a normal
group message, so everyone sees it and it survives a reload.

Any member can put a time on the next session; it drives the shared focus timer
and is announced in the feed, so nobody has to be told separately.

## Moving to PostgreSQL

The schema avoids anything SQLite-specific, so production is three steps:

1. `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at your server
3. Swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in
   `src/lib/db.ts`

Nothing above that file changes.
