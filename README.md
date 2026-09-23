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
| `src/lib/oauth/` | Google sign-in: flow secrets, token exchange, ID token |
| `src/server/oauth.ts` | Account linking rules |
| `src/server/reminders.ts` | Deadline and exam notifications |
| `src/server/export.ts` | Account export and .ics calendar |
| `src/lib/insights.ts` | Computed summaries (not model output — labelled as such) |
| `src/server/` | Data access, all of it user-scoped |
| `src/app/(app)/` | The authenticated screens |

### Google sign-in

Optional. With no `GOOGLE_CLIENT_ID` the button is not rendered at all, so it
can never be a dead control — the app simply stays on email and password.

The plain authorization-code flow, with no OAuth library: it is two HTTPS
calls and a signature check, and `jose` was already a dependency for the JWT
part. Three one-time values guard the round trip, each closing a different
hole — **state** ties the callback to the browser that began it, **PKCE** ties
the code to this flow's secret, and a **nonce** ties the ID token to this
request. All three live in one short httpOnly cookie, never in the URL.

**Linking is where a mistake would be an account takeover**, so the rule is
explicit. Accounts match on Google's `sub`, never the email, because people
change addresses and a recycled one must not inherit someone else's account.
When the address already belongs to a user, the accounts are linked **only if
Google reports it verified** — otherwise anyone able to obtain a token for an
unverified address would inherit whatever account holds it. That refusal has
its own test.

Unlinking is refused when it would leave an account with neither a password
nor a provider, since one click should not lock somebody out of their own
data.

Setting it up: create a Web application client at
[Google Cloud credentials](https://console.cloud.google.com/apis/credentials)
and register `<APP_URL>/api/auth/google/callback` as the redirect URI. It must
match exactly, including the port.

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

`tests/resolver.mjs` also transpiles `.tsx` through the TypeScript compiler
that is already a dependency, since Node strips types but does not understand
JSX. That is what lets components be rendered and asserted on, rather than
only the logic behind them.

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

### Mso Bashkë — multiplayer study spaces

The signature feature. A space is a room students sit in together: a map they
move around, a shared focus clock, presence, chat and an AI facilitator.

**The room is data, not a picture.** Each environment is a palette, a zone and
seat layout (`src/lib/spaces/environments.ts`) and a furniture list
(`src/lib/spaces/props.ts`). The map is drawn from those at runtime as an
isometric scene, so adding a room is adding two entries rather than
commissioning an illustration, and no room costs an image download. The
thumbnail in the picker is the real palette, so what you choose is what you
get.

The scene is a 2:1 isometric grid. Floor, furniture and people all go into one
list, get sorted by how far back they sit, and are painted in that order —
which is what makes a student standing in front of a bookshelf actually
occlude it, and the difference between a room and a diagram. Every solid
object is the same primitive: a box with a lit top, a mid-tone left face and a
dark right face, so the whole room agrees about where the light comes from.

Because it is geometry, it is testable without a browser. `tests/iso-map.test.ts`
checks that the projection round-trips, that no table stands on a seat, and —
the one that actually matters for usability — that every seat in every room is
reachable by flood-fill from the spawn point. A chair walled in behind a
bookshelf looks fine in review and is infuriating to use.

**The server owns the clock.** `StudySpaceSession` stores when the current
phase began and how long it runs; every browser derives its countdown from
that and corrects for the age of the snapshot it holds. Two students never see
different numbers, and reloading mid-round does not restart anything. The
cycle itself lives in `src/lib/spaces/session.ts` as pure functions, so a whole
five-round session can be tested without waiting four hours.

**Realtime is push, not polling.** The old group feed held an SSE connection
open and then queried the database every 1500ms inside it, which is polling
with extra steps. `src/server/realtime.ts` is an in-process event bus: a write
publishes, and every open connection for that space is handed the event in the
same tick. An idle room now costs nothing. The scope is one Node instance,
exactly like the rate limiter; running several means giving the bus a shared
backend, and nothing outside that file changes.

**Presence uses only what the browser actually knows** — tab visibility, real
keypresses and pointer movement, and whether the connection is open. There is
no webcam analysis, no face detection and no gaze tracking, and the AI is told
nothing beyond those signals. A study app that watches you through the camera
to check you are concentrating is a surveillance product; this is not one.

Going away stops credited focus time accumulating. It never deducts any, and
it never pauses the group's clock — one person stepping out must not cost
everyone else their round. Before anyone is marked away they are asked whether
they are still there.

**Ambience is personal by default.** A shared room is not a shared pair of
headphones: one student concentrates to rain and another to silence. A host
can sync it, and the UI says so when they have.

Points work the same way round: they exist to make consistency visible, and
nothing in the system subtracts them.

| Path | What lives there |
|---|---|
| `src/lib/spaces/environments.ts` | Rooms, palettes, zones, seats, ambience |
| `src/lib/spaces/props.ts` | The furniture in each room |
| `src/components/spaces/iso.ts` | Isometric projection and shading |
| `src/components/spaces/iso-props.tsx` | The furniture, drawn |
| `src/lib/spaces/session.ts` | The focus/break cycle, pure |
| `src/lib/spaces/presence.ts` | Activity resolution, points, group focus |
| `src/lib/avatar.ts` | The character, stored once per student |
| `src/server/realtime.ts` | The push bus |
| `src/server/spaces.ts` | Space data access, all membership-scoped |
| `src/components/spaces/` | Map, avatar, ambience, the room hook |

Private spaces need the six-character code, friends-only spaces need an
accepted friendship, and a code buys only enough to render a join prompt —
name, subject, capacity and rules — never the room's contents.

## Moving to PostgreSQL

The schema avoids anything SQLite-specific, so production is three steps:

1. `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at your server
3. Swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in
   `src/lib/db.ts`

Nothing above that file changes.
