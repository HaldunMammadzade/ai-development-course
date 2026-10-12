# Roadmap

Each phase ends when its exit criteria pass. The next phase does not start inside the previous phase's pull requests.

The expensive and risky work is called out so it is not "just another ticket": model spend, the runner, and the teacher state machine.

## Phase 1 — A real lesson with a real student

Goal: one verified student can take a Frontend lesson with a teacher that remembers, scores evidence, and stays inside the lesson. The student can tell a teacher from a chat box because the teacher asks, waits, and follows the lesson.

### Foundation (step 1) — done

The repository is a pnpm/Turborepo workspace with `apps/web`, `apps/api`, and the shared packages. The API serves `GET /api/v1/health` and compiles with `tsc`. Shared packages export their foundations only: strict TypeScript config, env parsing, the AI provider interfaces, an empty Prisma schema, the curriculum format version, the `cn` helper, and the API error schema.

Not in this step: authentication, lessons, the teacher, database models, Postgres, Redis, and deployment.

Local checks from the repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Copy `.env.example` to `.env` before `pnpm dev`. The web app listens on port 3000 and the API on port 3001. `NODE_ENV` is required. `PORT` and `DATABASE_URL` are required when `NODE_ENV=production`.

### Identity foundation (step 2) — done

PostgreSQL identity tables and the first migration: users, sessions, email verification tokens, password reset tokens, and a per-user quota counter. The API has password hashing (Argon2id), opaque session handling, and user creation/lookup. Auth HTTP routes were added in step 4. The quota counter was removed in step 3.

Not in this step: register/login/logout endpoints, mail delivery, rate limits, curriculum seeds, lessons, the teacher, plans, and payments.

`docker-compose.yml` starts PostgreSQL 16 with the local `DATABASE_URL` from `.env.example`. Copy `.env.example` to `.env` before using identity against that database. `pnpm prisma validate` and `pnpm prisma generate` check the schema. Integration tests run when `DATABASE_URL` points at a reachable Postgres; otherwise they are skipped.

### Curriculum and learning domain (step 3) — done

Published Frontend curriculum for Web Fundamentals and HTML, with draft CSS, JavaScript, and Backend structure. The learning migration adds the Phase 1 curriculum, progress, teaching, memory, and plan tables and drops the interim `quotas` table. Deterministic mastery, prerequisite unlock, `nextAction`, and the teaching state machine are in the repo. There is no teacher HTTP API and no model call.

Not in this step: auth HTTP routes, the AI teacher, dashboard UI, payments, code execution, projects, interviews, and voice.

### Auth HTTP and student onboarding (step 4) — done

`POST /api/v1/auth/register`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/password-reset/request`, `POST /api/v1/auth/password-reset/confirm`, and `GET /api/v1/me`. Registration creates default preferences, one Free plan assignment, and one active Frontend enrollment. Login sets an httpOnly session cookie only after email verification. `GET /api/v1/me` returns `nextAction` from the deterministic engine. `GET /api/v1/auth/teaching-access` is the verified-email gate. No mail is sent. Rate limits are still not enforced.

Not in this step: the AI teacher, teaching turns, payments, subscriptions, and Phase 2+.

### AI teacher foundation (step 5) — done

`packages/ai` has the OpenAI-compatible provider, the teach model router, the strict teacher-result schema, server-side normalization, the context builder, versioned v1 prompts, and usage and explanation-cache contracts. That step wired them with no public route. Quota enforcement and the teaching turn route arrived in step 6.

Not in this step: teaching turns, a public AI endpoint, interviews, projects, code execution, and payments.

### Teaching HTTP (step 6) — done

`POST /api/v1/teaching/sessions` chooses the lesson from `nextAction`. `POST /api/v1/teaching/sessions/:id/turns` runs one `teach` call outside a database transaction, then commits messages, learning events, mastery, misconceptions, memory notes, homework, `ai_usage`, and the idempotent result. The idempotency key is the existing unique `(session_id, client_turn_id)` on the student message. Free-plan quota is 40 turns per student-local day and 600 per student-local month. Personalized turns are not cached. No new migration.

Not in this step: Monaco, code execution, exercises, projects, interviews, voice, payments, Redis, and SSE deltas.

### Homework completion and teaching hardening (step 7) — done

`GET /api/v1/teaching/homework` and `POST /api/v1/teaching/homework/:id/complete` finish assigned homework without completing it when the lesson ends. Completion writes evidence 80 at weight 1.0, source `homework`, then mastery and `nextAction`. A second completion is a no-op. Successful teaching turns are also capped at 20 per rolling 10 minutes. The teach route stays `fast` unless configured `strong`, in which case `plans.daily_strong_calls` applies in the student's timezone. The free-plan default is 0 strong calls. Stream event names exist for a later client. The turn response is still one JSON body. No new migration.

Not in this step: Monaco, code execution, exercises, projects, interviews, voice, payments, Redis, vector search, and a live SSE response.

### Student web app (step 8) — done

`apps/web` is the Azerbaijani student application: register, verify, login, dashboard, the published Frontend path, a lesson page, and homework. It uses the existing session, teaching, and homework APIs. `GET /api/v1/learning/catalog` is the only new read. It returns published lessons as completed, current, or locked from `nextAction`, plus concept mastery. The browser talks to the API through a same-origin `/api` rewrite. Turns stay one JSON response. There is no SSE stream and no code execution.

Not in this step: Monaco, a sandbox, exercises, projects, interviews, voice, payments, organizations, admin, analytics, Redis, embeddings, WebSockets, and multi-model chains.

### Teacher quality and student polish (step 9) — done

The teacher prompt is `teacher.system.v3` / `teacher.teach.v2`. The code review prompt is `code-review.v2`. It stays inside the current block, teaches in concise Azerbaijani, and treats student text as untrusted. The server still owns state, mastery, and evidence. Speech that echoes a prompt version or a secret is rejected as an invalid model response.

Register, login, and password-reset requests are counted in PostgreSQL (`auth_rate_buckets`), keyed by a hash of the action and the IP or email. There is no Redis. The catalog now includes `moduleTitle` and a human confidence level derived from evidence count. The student UI is the same routes, with a calmer shell, lesson layout, and empty states. Turns are still one JSON response. There is no SSE stream and no code execution.

Not in this step: Monaco, a sandbox, exercises, projects, interviews, voice, payments, organizations, admin, analytics, Redis, embeddings, WebSockets, and multi-model chains.

### Authored exercises (step 10) — done

A verified student can open an exercise attached to an unlocked published lesson, submit text, and receive a deterministic result. Exercise types are `multiple_choice` and `code_text`. `code_text` is a text area. The button says "Yoxla". The page says code execution is not available. There is no Monaco editor and no runner.

Validation rules live in the curriculum seed. The score is the share of rule points, from 0 to 100. The pass line is 70. A pass writes one learning event for the exercise concept and recomputes mastery with the existing formula. A fail writes no event. The same `clientAttemptId` returns the first stored attempt.

The teaching state machine and `nextAction` are unchanged. Exercises do not unlock the next lesson by themselves. Lesson order still depends on prerequisite mastery.

Not in this step: Monaco, a sandbox, code execution, hidden tests, projects, interviews, voice, payments, organizations, Redis, embeddings, WebSockets, and SSE.

### Coding classroom (step 11) — done

A `code_text` exercise opens a Monaco editor in the student app. Monaco is an editor, not a code execution environment. It loads only in that classroom, from the app bundle, and it is not initialized on the landing, login, register, or dashboard pages. Multiple choice stays a set of radios. The language shown to Monaco is mapped from the exercise: `html`, `css`, `javascript`, or plaintext. An unknown language becomes plaintext.

The editor starts from the authored `starterCode`. That value is applied when the exercise opens. Later renders do not replace what the student has typed. "Başlanğıc koduna qaytar" restores the starter locally. If the text is unchanged, it does not ask. It does not call the API, create an attempt, or change mastery. There is no draft table and no autosave.

"Yoxla" still posts `{ clientAttemptId, submission }` to `POST /api/v1/exercises/:id/attempts`. The browser does not send a score, a pass flag, mastery, rules, or the language. A network failure retries the same `clientAttemptId`. A completed attempt uses a new id for the next explicit submit. The server response is the only result: score, feedback, and the human-readable check summaries. Student code stays text. Nothing on this page executes it.

Not in this step: a sandbox, Docker, a code runner, hidden tests, runtime evaluation, a terminal, projects, interviews, voice, payments, organizations, admin, analytics, Redis, embeddings, agents, browsing, SSE, and WebSockets.

### Secure JavaScript execution (step 12) — done

A published JavaScript exercise can require execution. The student still posts `{ clientAttemptId, submission }` to the existing attempt route. The API does not run the source. `apps/runner` starts one short-lived container per execution, with no network, no host mounts, no Docker socket, and no application secrets. The container returns which hidden tests passed. The API turns those observations into the score, the pass decision, and mastery. The client never receives the tests or the expected values.

Real execution needs Docker and the `platform-js-sandbox:12` image. Unit and API tests use a fake runner that does not execute code. HTML and CSS exercises stay on the static checks. There is no terminal, no package install, no second language, no SSE, and no WebSocket.

### AI code reviewer (step 13) — done

After a stored JavaScript attempt, the student can ask for an explanation, a hint, or a review. The model sees the stored source and the aggregate result. It does not see hidden tests, and its output cannot change the score, mastery, or the next lesson. A passing attempt does not call the model until the student asks. Multiple-choice exercises have no reviewer. If the model is unavailable, execution still scores the attempt.

### Project-based learning (step 14) — done

One published frontend project, “Şəxsi Portfolio Səhifəsi”, is available after mastery of the published HTML concepts `html.elements`, `html.text`, `html.links`, and `html.attributes`. Draft CSS and JavaScript modules stay draft. The project has six sequential milestones. The server decides the current milestone, the pass, the score, and completion. A failed milestone can be retried. A passed milestone does not regress.

The editor accepts only `index.html`, `style.css`, and `script.js`. HTML and CSS milestones use authored static checks. The greeting milestone sends `script.js` alone through the existing JavaScript runner. Submitting an attempt does not call a model. A later review explains the stored files and cannot change the score, mastery, unlock, or completion. A full project solution from the model is rejected.

`pnpm --filter @platform/database db:seed` validates the curriculum and upserts it by slug. It requires `DATABASE_URL` and a built database package.

### Technical interview (step 15) — done

One published interview, “Frontend Developer Interview — Foundation”, opens after the same published HTML mastery gate as the portfolio project. A second interview stays draft. The interview is not a lesson. Ten authored questions cover HTML, CSS, JavaScript, the browser, URLs, and HTTP. One of them asks for an `isEven` function and runs it through the existing JavaScript sandbox. One authored follow-up can be selected by the server. The model cannot invent questions.

The session states are `active` (phase `question` or `follow_up`), `completed`, and `abandoned`. The server chooses the current question. A student can hold one active interview, finish two per day, and start ten per seven days. Each interview allows at most 30 model calls. Repeated `clientAnswerId` returns the stored result and does not call the model again.

Verbal understanding maps to fixed evidence: unknown 20, incorrect 20, partial 60, correct 90. Code evidence is `round(0.7 * execution score + 0.3 * verbal evidence)`. One follow-up blends as `round(0.75 * parent + 0.25 * follow-up)`. The final score is the weighted average of the main questions. The report prose is stored separately from that number. Completion writes at most eight learning events, only for authored concepts, with evidence capped at 70, and only when that evidence is at least 60.

Not in this step: voice, streaming, a second language, an autonomous interviewer, or questions generated by the model.

### Speaking practice (step 16) — done

`/app/speaking` is a push-to-talk practice, not a realtime voice assistant. The student records at most 60 seconds, or types a fallback answer. The browser sends one finite upload. The API transcribes it through `SpeechToTextProvider`, then sends the transcript through the existing `teach` or `interview` model route. Twelve authored questions come from the published curriculum. The server chooses the current question, the next question, and whether a correct answer writes mastery.

Raw audio is held only in memory for the transcription call and is not stored. A missing transcription key returns `503 SPEECH_UNAVAILABLE` and leaves the session usable through the text fallback. An unclear or failed transcript writes no mastery. A correct answer writes one learning event with evidence 40, at most four per session.

Not in this step: streaming audio, WebSockets, SSE, text-to-speech, voice cloning, pronunciation scores, or a second programming language.

Build order:

1. Monorepo skeleton: pnpm, Turborepo, strict TypeScript, shared lint and tsconfig, CI. Done.
2. Identity schema, first migration, password hashing, and session services. Done.
3. Curriculum types, validation, seed, mastery, `nextAction`, and the teaching state machine. Done. Auth field schemas were already done.
4. API auth: register, verify, login, logout, reset, session guard. Done.
5. Curriculum read APIs. `GET /api/v1/learning/catalog` is the student read. The older `/dashboard` and `/paths` sketches are not routes.
6. Web: auth screens, dashboard, path, and lesson page. Done in step 8, on top of the teaching API.
7. Teaching session persistence, with a fake AI provider in tests. Done.
8. `packages/ai`: provider, router, prompts v1, context builder, result guard, wired to the teaching turn route. Done.
9. Misconception writes, homework persistence, quota enforcement, and `ai_usage` writes. Done for teaching turns.
10. Hardening: teaching burst limit, the strong-model cap, and register/login/password-reset rate limits are enforced. The deletion job and the rest of the launch checks in [security](./security.md) are still later.

Exit criteria:

- A new user can verify email, sign in, and see one next action.
- Explain and Socratic sessions walk the state machine on a published lesson.
- A wrong answer produces a hint, not the full solution, on the first miss. Covered by a fake-provider test and one manual pass.
- Reloading the lesson restores the session.
- A second day, the context packet includes the stored misconception or homework and omits unrelated history. Asserted by the context-builder test.
- Skill rows appear only after evidence. Unseen concepts stay null.
- Over-quota turns return `QUOTA_EXCEEDED` and write no extra model call.
- Typecheck, unit tests, and auth e2e are green.

Stay out of this phase: the code runner, exercise generation, skill-graph visualization beyond a list, projects, interviews, voice, payments, admin, organizations, Redis, pgvector. The Monaco editor from step 11 stays a client-side editor. It is not the Phase 2 runner. Authored non-executing exercises from step 10 stay.

Content bar: Module 1 and Module 2 are reviewed by a human in Azerbaijani before they are published. Draft modules can be empty of blocks.

## Phase 2 — Write code, run it, get a review

Goal: the lesson's exercise states run real JavaScript and TypeScript, and feedback teaches instead of rewriting.

Build order:

1. Runner process, HMAC, isolate, timeouts, no-network deployment notes, security tests.
2. Exercise schema and seed for the lessons that already exist.
3. Run controls on the existing editor: stdout and the visible test list. The editor is already in the student app and does not execute code.
4. Hint ladder: authored hints, then one model hint.
5. Code review on submit and on demand. Dimension scores plus a short lesson. No automatic rewrite.
6. Wire exercise results into `learning_events` with server-owned weights.

Exit criteria:

- A passing and a failing fixture exercise behave correctly.
- A hostile fixture cannot read env or open a socket, and an infinite loop dies.
- Hidden tests stay hidden.
- Run does not call the model. Review does, once.
- Mastery moves when tests pass or fail, without a model-supplied score.

## Phase 3 — Skill graph, remedial practice, projects

Goal: the path starts to adapt between lessons, and a student can build a small project with a mentor.

- Skill map UI from the concept graph.
- Weak-concept revision sessions.
- Offline exercise generation into a pending queue. Approval can be a SQL update or a minimal internal screen. Students never see pending rows.
- One beginner project (todo) and one intermediate project (task manager), authored as milestones and tasks.
- Mentor review per task.

Exit criteria:

- A concept held under 45 after its lesson shows up as the next action.
- Generated exercises do not appear until approved.
- A project task can be submitted and reviewed without the mentor replacing the student's files.

## Phase 4 — Interview and voice

Goal: interview prep and spoken teaching use the same profile.

- Interview kinds, turn cap, one grading call, improvement plan.
- Push-to-talk speech-to-text is in step 16. Text-to-speech, streaming audio, and a shared minute quota are still future work. Voice turns that exist call the existing teach or interview route.
- Minute quota separate from turn quota.

Exit criteria:

- A finished interview shows the five scores and a plan, and writes learning events only for concepts the grade actually covered.
- A voice turn and a text turn in the same session share one transcript and one mastery projection.
- Voice cannot run with an empty minute quota.

### Subscriptions and entitlements (step 17) — done

Free, Starter, Pro, and Premium are configuration rows. Prices are 0, 9.90, 19.90, and 34.90 AZN per month in `plan_prices`, not constants in request handlers. The API owns checkout, webhook verification, subscription status, and entitlements. A browser return URL does not activate a plan. `FakePaymentProvider` is available only outside production. No live payment provider is configured in this environment, so checkout stays unavailable until `PAYMENT_*` is set. Invoices, tax, coupons, and an admin console are not in this step.

### Production hardening (step 18) — done

Transactional email, a PostgreSQL job table, cleanup of expired temporary rows, liveness versus readiness, request correlation, and shutdown handling. Learning, mastery, execution, interviews, speaking, and subscription authority are unchanged. No live email provider is configured here, so development and production-without-credentials do not claim a message was sent. `FakeEmailProvider` is rejected when `NODE_ENV=production`.

## Phase 5 — Commercial operations

Goal: charge in AZN, operate the business, prepare for a school tenant.

- Payment provider interface, checkout, and webhook idempotency are in step 17. A customer portal, invoices, tax, and admin cost views are still future work.
- Admin: publish lessons, approve exercises, view `ai_usage` cost per student, disable a user.
- Retention queries: DAU, MAU, lesson completion, quota hit rate, cost per active student.
- Organization and membership tables when the first school pilot is real.
- Account export.

Exit criteria:

- A webhook replay does not double-apply a plan.
- An admin can read cost per active student for the last 30 days.
- A student on Starter hits a different quota than Free, driven by the `plans` row.

## Suggested Phase 1 pull requests

Small enough to review:

1. Tooling and CI.
2. Schema, migration, seed.
3. Auth.
4. Curriculum reads, dashboard API, dashboard UI.
5. Teaching session without a live model.
6. Live model, memory, mastery, quotas.
7. Security and deletion pass.

No pull request in that list should add the runner or a second product surface "while we are here."

## Risks and the phase that has to pay them down

| Risk                     | Paydown                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Chatbot drift            | Phase 1 state machine, rubrics, and the forced exit from `explain`                                                             |
| Model bill               | Fast route, context caps, quotas, cache, no model on Run                                                                       |
| Sandbox escape           | Phase 2 runner tests before the feature is reachable                                                                           |
| Wrong mastery            | Event log, rebuildable projection, unseen versus zero, unit tests on the formula                                               |
| Weak Azerbaijani         | Human-reviewed seed, glossary, style set by the student                                                                        |
| Latency                  | SSE contract, fast model, output caps                                                                                          |
| School multi-tenancy     | Delayed until a pilot. `user_id` scoping stays mandatory so the later organization column is an extra predicate, not a rewrite |
| Interview and voice cost | Separate caps, Phase 4, strong model only on the final grade and on rare debug or planning tasks                               |

## Admin and product analytics (step 19) — done

Internal read-only admin at `/admin` and `GET /api/v1/admin/*`. Role is the database column `users.role`. The admin UI does not change mastery, scores, subscriptions, quotas, or AI usage. Metrics are aggregated from the existing tables. No new learning feature, no Redis, and no seeded admin password.

## Release candidate (step 20) — done

Production configuration, provider boundaries, the Docker sandbox, shutdown, backup restore, and admin aggregates were checked without a new product feature. Live AI, email, speech-to-text, and payment providers stay unverified until real credentials are exercised. The release checklist is `docs/release.md`.

## Approval gate

The architecture and the six decisions were approved. Foundation steps 1–3 are complete. The next implementation step does not start until you ask for it.

Approved decisions:

1. Phase 1 teaches through authored checks. Code execution waits for the runner.
2. Lesson order is fixed until Phase 3. Adaptivity is inside the lesson.
3. Sessions are httpOnly cookies. The model is an OpenAI-compatible adapter behind a router.
4. SSE, pg-boss, no Redis, no vector database, no organizations table in the first migration.
5. Free-plan quotas exist before billing. Starting point: 40 teacher turns a day, 600 a month.
6. Adult learners only.

## Product Readiness Audit and Next Milestone — Step 46.0

Date: 12 October 2026. Audit only. No application source, schema, prompt, model, or public API was changed.

### 1. Current product readiness

The learner can already move through a server-owned Frontend path. A verified student gets one next action, an Azerbaijani lesson with a teacher that commits state only after a valid turn, authored exercises, JavaScript execution in the sandbox, an optional review that cannot change the score, one portfolio project, one interview, push-to-talk practice, a revision queue, a skill map, and read-only achievements. `getNextAction`, mastery, and exercise scoring stay on the server.

That loop is not equally sound at every step.

| Step     | What the student can do now                                                                                                                                    | Where it is weak                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LEARN    | Open the legal lesson. The teacher sits in the lesson column below `xl` and in the side column from `xl`.                                                      | A turn still waits for one JSON body. Streaming stays out of scope.                                                                                                                 |
| ANSWER   | Check questions and multiple choice return authored feedback.                                                                                                  | None of the inspected gaps beat the exercise placement bug below.                                                                                                                   |
| CODE     | Monaco for `code_text`. JavaScript exercises with `execution` run in the sandbox. HTML and CSS stay on static checks.                                          | Three published function exercises are attached to the first web lesson.                                                                                                            |
| RETRY    | Static rules list passed and failed checks. An execution result is one sentence: how many checks passed, then that some failed. `failedRules` is always empty. | Useful only after the exercise sits on the right lesson. Revealing hidden inputs or expected values would break the sandbox contract.                                               |
| PASS     | A pass writes one learning event for the exercise’s concept and recomputes mastery. A fail writes none.                                                        | `js-add`, `js-is-even`, and `js-reverse-string` store that event on `web.http`.                                                                                                     |
| REMEMBER | Teaching turns can upsert a misconception. Revision schedules published concepts that already have a successful event and an open exercise.                    | Revision does not repair a concept that was credited for the wrong skill. Step 45.17 still stands: there is no stored AI failure distribution, and this audit does not add logging. |

Teacher-in-column layout is already in `lesson-workspace.tsx` (`xl:hidden` plus the sticky aside). Dashboard hierarchy was implemented on 10 October 2026. Those are not the next milestone.

### 2. Evidence-backed gaps

**Selected gap — function drills credited as HTTP.** `executionExercise` in `packages/curriculum/src/frontend-exercises.ts` publishes `js-add`, `js-is-even`, and `js-reverse-string` with `lessonSlug: "how-the-web-delivers-a-page"`, `conceptSlug: "web.http"`, and `position: 4` on all three. The first lesson’s primaries are `web.http` and `web.browser` (`frontend-seed.ts`). The functions lesson is published (`frontend-seed.spec.ts` includes `js-functions`) with primary `js.function` (`frontend-expansion.ts`). That lesson already has `js-function-return` and `js-double`. The integrity test only checks that a published exercise’s lesson is published. It does not check that the concept is a concept of that lesson.

A student on the first lesson is asked to implement `add`, `isEven`, and `reverseString`. A passing attempt writes exercise evidence for HTTP. The function lesson never receives those passes. Historical events were not queried. The seed is sufficient to show where the next attempt will write.

**Deferred gap — opaque execution retry.** `scoreExecution` in `packages/execution/src/score.ts` returns `passedRules: []` and `failedRules: []`. The public sentence is `1/3 yoxlama keçdi. Bəzi yoxlamalar uğursuz oldu.` Static exercises already return authored rule feedback, and `ExerciseResult` renders it. Hidden tests, expected values, and ids such as `rev-c` must stay off the client. This is a real retry problem. It is second, because clearer feedback on the first lesson would still practice the wrong concept.

**Not selected.**

- Observability and the hidden-literal log label. Step 45.17: no drain stores the diagnostic fields, and logging must not be added to invent counts. Not an operational blocker for learning.
- Changing `getNextAction` so a weak concept jumps the path. Phase 3 text still says a concept under 45 becomes the next action. The shipped path deliberately does not reorder lessons. That would be a contract change.
- A new model, prompt rewrite, or stream. Prior samples were too small to switch models. Streaming was tried and not shipped.
- Remaining premium-UX token and auth-field work. Visual consistency. It does not change what a pass means.
- Payments, invoices, organizations, text-to-speech, and generated exercises. No demonstrated learner blockage in the current path.

### 3. Ranked candidates

| Rank | Candidate                                                                            | Learner impact                                                                                       | Evidence                                                                                            | Effort                                                                                    | Regression risk                                                                        |
| ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1    | Move the three function exercises onto `js-functions` and credit `js.function`       | The first lesson stops drilling unrelated functions. A pass counts for the skill the code practices. | Hardcoded lesson, concept, and shared position in the seed. Functions lesson is already published.  | Small curriculum change plus tests. No new API.                                           | New attempts change which concept moves. Old events must stay where they were written. |
| 2    | Public per-check sentences for execution, without hidden inputs or expected values   | A failed run tells the student which authored check failed.                                          | `scoreExecution` drops rule lists. UI already renders them for static checks.                       | Schema or seed labels, scorer, and tests. Must not leak `expected` or forbidden literals. | Medium. Easy to expose a hidden test. Do this after rank 1.                            |
| 3    | Type tokens and auth field fill from the premium UX audit                            | Clearer hierarchy and fields.                                                                        | Audit section 8, items 5 and 6, still open. Lesson column and dashboard hierarchy are already done. | Presentation only.                                                                        | Low, and low learning value.                                                           |
| 4    | Weak-concept next action, model or prompt change, streaming, or more diagnostic logs | Speculative or already declined.                                                                     | Roadmap Phase 3, AI audit, Step 45.17.                                                              | Crosses mastery, provider, or logging contracts.                                          | High.                                                                                  |

### 4. Recommended next milestone

**Place the published function drills on the functions lesson.**

`js-add`, `js-is-even`, and `js-reverse-string` become exercises of `js-functions` with concept `js.function`. Positions must be unique and must not collide with `js-function-return` (1) or `js-double` (2). The first web lesson keeps its HTTP and browser exercises only.

### 5. Scope, acceptance criteria, dependencies, and risks

Scope:

- Change those three definitions in the curriculum seed. Reseed updates the exercise’s lesson and concept by slug.
- Extend the curriculum integrity test so a published exercise’s concept is a primary or supporting concept of its lesson, and positions on one lesson are unique.
- Keep `getNextAction`, the mastery formula, attempt scoring, the runner, and the public attempt response unchanged.

Acceptance criteria:

- The first published lesson does not list `js-add`, `js-is-even`, or `js-reverse-string`.
- Those three are published on `js-functions`, concept `js.function`, with distinct positions.
- A new passing attempt writes the learning event for `js.function`, not `web.http`.
- A failing attempt still writes no event.
- Hidden tests, expected values, and starter code stay off the client.
- Existing lessons, including `js-double`, keep their current checks.

Dependencies: the published `js-functions` lesson and the existing exercise upsert by slug. No migration, no dependency, no model change.

Regression risks:

- Do not rewrite or delete historical `web.http` events from earlier passes of these slugs. Past mastery stays as stored.
- A student who already opened the first lesson will no longer see these three drills there after reseed. That is the correction.
- Do not mark `js.function` mastered from old HTTP events.

Verification for the implementation step, not this audit: curriculum unit tests, one exercise HTTP test that a pass on `js-add` stores `js.function`, and a browser check that the first lesson’s exercise list is the HTTP and browser tasks while the functions lesson lists the moved drills. `EXECUTION_MODE=fake` for API tests. No full-suite claim is made here because this step did not change source.

### 6. Exclusions

- Do not change `getNextAction`, unlock thresholds, mastery weights, or revision intervals.
- Do not add public expected values, arguments, stdout, or test ids to the attempt response.
- Do not start the per-check execution feedback milestone in the same change.
- Do not add diagnostic logging, a log drain, or a new AI failure category.
- Do not change the provider, model, prompts, streaming, authentication, or safety filters.
- Do not add code execution for HTML, CSS, Git, or testing exercises.
- Do not backfill or delete learning events.

## Exercise Feedback Quality Audit — Step 46.3

Date: 12 October 2026. Audit only. No application source, schema, prompt, model, or public API was changed. Tests below were read from the current specs. This step did not re-run them.

### Files inspected

- `packages/execution/src/sandbox-feedback.ts`, `score.ts`, `score.spec.ts`, `protocol.ts`, `evaluation.ts`, `limits.ts`, `fake-runner.ts`, `index.ts`
- `packages/curriculum/src/exercise-validator.ts`, `frontend-exercises.ts`, `frontend-expansion.ts`, `frontend-interview.ts`, `project-checks.ts`
- `packages/types/src/exercise.ts`
- `packages/database/src/exercise-repository.ts`
- `apps/api/src/modules/exercises/exercise.service.ts`, `exercise.http.spec.ts`
- `apps/api/src/modules/interviews/interview.service.ts`
- `apps/api/src/modules/projects/project.service.ts`
- `apps/web/components/exercises/exercise-result.tsx`, `exercise-board.tsx`, `exercise-board.spec.tsx`
- `apps/web/lib/copy.ts`

### Path

A JavaScript exercise with `execution` is scored by `scoreExecution`. The runner observation is `{ id, passed }` plus a status. `parseExecutionResult` drops every other field and clears tests unless the status is `completed`. `SandboxFailureKind` stays inside the scorer. The stored attempt and `ExerciseAttemptView` receive only `feedback`, with `passedRules` and `failedRules` empty.

`ExerciseResult` prints that string under **Düzgün** or **Keçmədi**. While the request is in flight the board shows **Yoxlanır...** and `aria-busy`. A thrown request shows the API or network message and leaves the editor text in place. A `runner_error` never becomes an attempt: the service returns 503 `EXECUTION_UNAVAILABLE` (“Execution is unavailable.”) and stores nothing. An empty submission is scored before the sandbox as `Cavab boşdur.`

A learning event is written only when `passed` is true and `exerciseMasteryUpdate` returns a row, which requires a score of at least 70. The event uses the exercise concept, source `exercise`, and the attempt id. A failed attempt writes none.

The messages are not adaptive. Completed failures share one advice sentence. Only the passed/total count changes. Stopped runs change by execution status. The exercise prompt, entry name, and which check failed do not enter the sentence.

### Category → learner message

| Evidence | What the learner sees | Next action in the sentence |
| --- | --- | --- |
| `completed`, at least one configured check not passed | `{passed}/{total} yoxlama keçdi. Qaytarılan nəticə tələb olunan davranışa uyğun gəlmir. Funksiyanın qaytardığı dəyəri tapşırığa görə yenidən yoxla.` | Recheck the returned value against the task. |
| `completed` with no observations | The same behavior sentence, with a zero passed count. | Same sentence. This is the unclassified fallback. |
| `timeout` | `Kod 2 saniyəlik icra limitini keçdi. Yoxlamalar işləmədi. Dövrün bitdiyinə əmin ol.` | The limit sentence is exact. The loop advice is a hint. |
| `syntax_error` | `Sintaksis xətası var. Yoxlamalar işləmədi. Əvvəl sintaksisi düzəlt.` | Fix syntax before another check. |
| `runtime_error` | `Kod icra edilərkən xəta baş verdi. Yoxlamalar işləmədi. Funksiya nəticə vermədən dayandı.` | The function stopped before a result. No error text is included. |
| `memory_limit` | `Kod yaddaş limitini keçdi. Yoxlamalar işləmədi. Daha az yaddaş tutan bir yol yoxla.` | Try a path that uses less memory. |
| `process_limit` | `Kod proses limitini keçdi. Yoxlamalar işləmədi. Əlavə proses açmadan yenidən yoxla.` | Retry without extra processes. |
| `runner_error` | No sandbox sentence. HTTP 503, no attempt, no success event. | Retry when execution is available. |
| Every configured check passed | `3/3 yoxlama keçdi.` with **Düzgün**, the score, and **İrəliləyiş yeniləndi.** | Continue the lesson. |

Wrong return type and a specific edge case are not categories. The observation has no actual value, expected value, or type. The specs assert that a completed failure does not contain `kənar` or `tip`.

### Representative cases

Published execution suites are `js-double`, `js-add`, `js-is-even`, `js-reverse-string` (points 34/33/33) and `js-array-first` (50/50). The interview even-check is 50/50. On these suites a score of at least 70 requires every check to pass, so **Düzgün** and the pass sentence stay together.

- Incorrect output. Fake runner `return 0` and `return a - b` become `0/3` and `1/3` plus the behavior sentence. Score 0 or 34, `passed` false, no learning event. HTTP spec locks both strings and the absence of `add-a`.
- Wrong type or structure. Not detected. A boolean where a number is required is the same behavior sentence.
- Runtime or stopped execution. HTTP spec locks the timeout, syntax, and thrown-error sentences, score 0, and no event for the timeout. Memory and process are mapped in `score.spec.ts` from those statuses.
- Unclassified. A completed result with an empty test list uses the behavior sentence. The spec names this the generic fallback.
- Success. Feedback is exactly `3/3 yoxlama keçdi.`, score 100, and one exercise event on `js.function` with evidence 100 and weight 1.

Hidden inputs, expected outputs, test ids, and the entry name stay out of `JSON.stringify` of the scored result (`rev-c`, `Qx7`, `7xQ`, `reverseString`, `add-a`). The exercise detail response is also asserted free of those tokens. Static exercises still use authored `passedRules` and `failedRules`. That path is separate and was not changed.

### Safety and usefulness

The public sentence is safe for every category the runner can actually prove. It tells the learner whether the checks compared and failed, or whether execution stopped, and it gives one next step. It does not name a hidden check.

Usefulness stops at that kind. A 1/3 failure and a 0/3 failure give the same advice. The timeout sentence adds “make sure the loop ends” without evidence that the program contains a non-terminating loop. The unclassified completed run is worded as a behavior mismatch, which matches how missing observations are scored (they count as not passed) and does not invent a type or an edge case.

`passed` follows the score threshold of 70. The failure sentence follows “not every check passed.” Those two agree on every current published execution suite. They would diverge only if a future suite could reach 70 while one check failed.

### Concrete gap

`reviewFacts` in `exercise.service.ts` still classifies a stopped attempt by exact equality with the old one-sentence `EXECUTION_MESSAGES`. The stored sentences now continue after that first sentence, so a timeout, syntax error, memory limit, or process limit falls through to `runtime_error` in the optional review prompt. A completed failure still parses, because the count prefix matches `/^(\d+)\/(\d+) yoxlama keçdi/`. The learner’s own result text is already correct. The interview path keeps `result.status` separately, so it does not use this parser. Project checks still store the old one-sentence strings and were not part of Step 46.2.

### Follow-up

Another learner-facing feedback milestone is not justified. The sandbox does not know which check failed, what the values were, or whether the failure was a type or an edge case. Adding that would expose hidden tests or expand the execution protocol.

The one justified change is to make `reviewFacts` recognize the current stopped sentences, so an optional explanation keeps timeout, syntax, memory, and process. That repair must not change the learner sentence, the score, the pass threshold, or the runner.

### Recommended next step

Repair `reviewFacts` to read the current stopped feedback, then leave sandbox feedback as it is. Do not add per-check, type, or edge-case copy.

### Exclusions

- Do not change scoring, hidden tests, sandbox limits, attempt contracts, mastery, revision, or `getNextAction`.
- Do not add a dependency, a log field, or an AI call.
- Do not copy hidden inputs, expected outputs, test ids, or reference solutions into the public result.

## Exercise Review Status Integrity Audit — Step 46.5

Date: 12 October 2026. Audit only. No application source, schema, or database row was changed. The tests cited here were read. This step did not re-run them.

### Files inspected

- `apps/api/src/modules/exercises/review-facts.ts`, `review-facts.spec.ts`
- `apps/api/src/modules/exercises/exercise.service.ts`
- `apps/api/src/modules/exercises/exercise-review.http.spec.ts`
- `packages/database/src/exercise-repository.ts`
- `packages/database/prisma/schema.prisma` (`ExerciseAttempt`)
- `packages/execution/src/protocol.ts`, `score.ts`, `evaluation.ts`
- `packages/curriculum/src/exercise-validator.ts`
- `packages/types/src/exercise.ts`, `packages/types/src/learning.ts`
- `packages/validation/src/exercise.ts`
- `apps/web/components/exercises/exercise-result.tsx`
- `apps/api/src/modules/admin/admin.http.spec.ts` (the only other `passedRules` write outside the exercise repository)

### Data flow

`ExerciseAttempt.passedRules` is an untyped `Json` column. The public type `ExerciseRuleSummary` is only `{ feedback: string }`. There is no execution-status column and no check constraint on the JSON.

A JavaScript exercise that reaches the runner does this:

1. `scoreExecution` returns `passedRules: []` and `failedRules: []` for every status, including `completed`. The learner sentence stays in `feedback`.
2. `runner_error` throws `EXECUTION_UNAVAILABLE` before persist, so that status is never stored.
3. For every other `ExecutionStatus`, `submit` appends `{ executionStatus }` after the rule summaries. Execution scoring passes an empty list, so the stored value is a one-element array.
4. `JSON.parse(JSON.stringify(...))` keeps that string field. Nothing later rewrites the column during review.
5. `toAttempt` and `readSummaries` rebuild the public attempt. An item is kept only when it has a string `feedback`. The status object has no `feedback`, so submit and history responses show `passedRules: []`.
6. Review does not use that public view. `reviewTarget` passes the raw JSON into `reviewExecutionFacts`.

Stopped example. Status `timeout` is stored as `[{ executionStatus: "timeout" }]`. Facts ignore the learner sentence and return `timeout`, 0 passed, and the exercise test count. A completed example stores `completed`. Facts then read `N/M yoxlama keçdi` from `feedback`, so a 1/3 miss stays `completed` with 1 of 3, and a pass stays `completed` with 3 of 3.

Static attempts never receive `executionStatus`. `evaluateExercise` stores only `{ feedback }` objects. An empty execution submission also skips the runner, stores `Cavab boşdur.`, and stores no status.

### Findings

The shared field does not break the current contracts.

- Intended contents. Callers that build rules, `evaluateExercise` and `scoreExecution`, write only `{ feedback }`. The status object is added in one place, `storedPassedRules`, and only when the service passes a runner status.
- Collision. A normal rule object has no `executionStatus` key. The marker has no `feedback` key. `readSummaries` and `readStoredStatus` therefore select different objects. Two different stored statuses, or a value outside `ExecutionStatus`, make facts return null. Review then returns 503 `AI_UNAVAILABLE` and does not call the model. The pending review is released by the existing catch path.
- Serialization and order. The marker is appended, not merged into a rule. The reader scans the whole array, so position does not drop it. Stringify keeps the key. No repository filter removes it on read for review.
- Public response. `ExerciseAttemptView.passedRules` stays `ExerciseRuleSummary[]`. The web result renders `rule.feedback` only. The review HTTP spec asserts the response arrays are empty while the stored JSON still contains `executionStatus`. Admin creates attempts for usage aggregates and does not return this column.
- Legacy rows. No `executionStatus` key means the text fallback. A leading `N/M yoxlama keçdi` is `completed`. A sentence that starts with the old one-line status text maps to that status, which also covers the current longer sentences. Unknown text returns null rather than `runtime_error`.
- Counts. A stored stopped status forces 0 passed and the configured total, even if `feedback` is later edited to a `1/3` sentence. The HTTP spec locks that timeout case. A stored `completed` status uses the summary counts.

No other module reads `passedRules` as execution metadata. Interview scoring keeps the runner status on its own result and does not use this column.

### Compatibility and privacy

The public attempt shape is unchanged. The stored token is one of `completed`, `timeout`, `memory_limit`, `process_limit`, `runtime_error`, `syntax_error`, or `runner_error`. It is not a hidden input, expected output, or test id. Learners do not receive it. The review prompt receives the status name, which is the point of the optional review.

### What is not a current defect

The TypeScript type on `NewExerciseAttempt.passedRules` is narrower than the JSON that is written. That is a layering gap. It is not a runtime failure: the execution writer starts from an empty rule list, and the public reader drops the extra object.

A later change could put `executionStatus` on a real rule object, or store the marker outside an array. Neither happens in the current writers. Non-array JSON is treated as absent and falls back to text. The column is required JSON and current writes are arrays.

An empty submission has no runner status, so optional review is unavailable. That matches the safe fallback. The attempt itself is still stored and shown.

### Options

| Rank | Option | Why |
| --- | --- | --- |
| 1 | Keep this design | Public rules, review facts, legacy text, and malformed values already behave as specified. Tests cover the split. |
| 2 | Narrow cleanup with no migration | A comment or a dedicated helper would document the mixed JSON. It would not change behavior. |
| 3 | Add a status column | A migration would make the type match the storage. Nothing in the current path reads the marker incorrectly, so the migration does not fix a learner or review bug. |

### Recommended next step

Do not change this storage. Move to a different product milestone. Another pass over review status would not change what the learner sees or how a review is classified.

### Exclusions

- Do not change scoring, hidden tests, sandbox limits, attempt responses, learner feedback, learning events, mastery, revision, or `getNextAction`.
- Do not add a column, a migration, a log, or an AI call.

## Adaptive Learning Path Integrity Audit — Step 47.0

Date: 12 October 2026. Audit only. No application source, curriculum data, or database row was changed. The tests cited here were read. This step did not re-run them.

### Files inspected

- `packages/curriculum/src/next-action.ts`, `next-action.spec.ts`
- `packages/curriculum/src/personalized-path.ts`, `graph.ts`, `learning-catalog.ts`
- `packages/curriculum/src/mastery.ts`, `adaptive.ts`, `revision.ts`, `teaching-state.ts`, `time.ts`
- `packages/curriculum/src/frontend-integrity.spec.ts`, `git-workflow.spec.ts`, `testing-fundamentals.spec.ts`
- `packages/database/src/teaching-repository.ts`, `exercise-repository.ts`
- `apps/web/lib/learning/dashboard.ts`, `apps/web/lib/teaching/workspace.ts`
- `apps/web/components/exercises/exercise-result.tsx` was not on this path; exercise outcomes were read from the repository
- `docs/product/personalized-learning-path.md`, `skill-graph.md`, `spaced-revision.md`

### Data flow

`getNextAction` is a pure function. Catalog presentation and the teaching repository both call it with the same inputs: due homework, open sessions, published lessons, prerequisite edges, and stored mastery. The web dashboard and lesson workspace render that result. They do not choose another lesson.

Order:

1. The earliest assigned homework that is due on the student-local day.
2. The open teaching session with the latest activity. `completed` and `abandoned` sessions are ignored.
3. Published lessons in module and lesson order. A credited lesson is skipped. Credit is lesson progress `completed`, or every primary at or above `UNLOCK_MASTERY` (60) while the lesson is unlocked. The first uncredited unlocked lesson is `start_lesson`. The first uncredited locked lesson stops the walk.
4. After that walk, concepts with `isWeak` (score below 45 and at least two evidence rows), lowest score first, become `review_concept` on the first published lesson that teaches the concept as a primary.
5. Otherwise `path_complete`.

`selectExercise` only sorts exercises inside an already open lesson. Revision builds a separate queue and does not replace `getNextAction`. A failed exercise writes no learning event. A passing exercise writes one event for that exercise’s concept. Lesson completion writes progress `completed` when the teaching state reaches `completed`, which the state machine forces after the recap and homework are stored. That write does not check the mastery score.

### Invariants

| Invariant | Result |
| --- | --- |
| Next action names a published item | `start_lesson` comes from the published list. Homework and an open session are not re-checked for publish status. Those rows are created only from an opened lesson. |
| Exercise belongs to its lesson and concept | Curriculum integrity requires a published exercise concept to be a primary or supporting concept of its lesson, and positions on a lesson to be unique. |
| A failed attempt does not advance mastery | `exerciseMasteryUpdate` returns null below 70. The attempt transaction writes an event only when that update exists. |
| A pass affects the intended concept | The event uses `exercise.conceptId`. Historical events are not rewritten. |
| Revision follows the stored schedule | Eligibility, the 21/42/63 day intervals, and the queue cap of 5 are unchanged. Revision does not write mastery. |
| Missing history fails closed | An empty mastery map still starts the first published lesson, which has no taught prerequisite. A draft lesson is omitted. |
| The UI does not invent a step | Dashboard hero and the workspace use `catalog.nextAction` or the session’s `nextAction`. `path_complete` has no link. |
| Repeated reads do not skip or duplicate | The function is deterministic for the same input. Due homework sorts by time then id. Sessions sort by latest activity. |

### Defect

Stopping on a locked lesson does not stop the function. The `break` leaves the loop, then the weak-concept scan runs, then the function returns `path_complete`.

`isWeak` is score below 45. Unlock is 60. A prerequisite at 45–59 is not weak and does not unlock the next lesson. If the current lesson is already credited by progress, the walk stops and the result is `path_complete`.

The dashboard then uses `copy.dashboard.pathComplete`: “Frontend yolunu tamamladın.” The hero link is null. The next published lesson stays locked.

This is reachable without a new formula. Homework completion is forced once the recap and homework exist. A partial check is stored at 45–75. One partial result can leave the primary below 60 while progress becomes `completed`.

`next-action.spec.ts` covers the shape of this case: lesson 1 completed, `web.http` at 59 with two evidence rows, lesson 2 locked. The assertion is only that the kind is not `start_lesson`. It does not forbid `path_complete`. Source after the `break` has no other return before the weak scan and `path_complete`. Score 59 is not weak, so the result is `path_complete`.

### Not defects

- An open session or due homework wins before the path. That is specified and tested.
- Git and testing stay off the current action while an earlier lesson is uncredited. Their first lessons are practice only when they are not the action. This audit did not treat optional practice as a new path.
- A known later concept does not skip an unknown prerequisite. The personalized-path tests lock that hole.
- `selectExercise` does not remove exercises. It orders the open lesson.
- The skill graph does not choose the next lesson.

### Candidates

| Rank | Change | Impact | Confidence | Effort | Regression |
| --- | --- | --- | --- | --- | --- |
| 1 | When the walk stops on a locked lesson, do not return `path_complete`. Return `review_concept` for the blocking prerequisite that is below 60, on the published lesson that teaches it. | The learner is sent back to the concept that still blocks the next lesson instead of being told the path is finished. | High. The fall-through is in `getNextAction` and the 59-point spec does not pin the kind. | Small. One branch and tests. No formula change. | Must not start the locked lesson, must not skip to a later module, and must still return `path_complete` when every published lesson is credited. |
| 2 | Make an open session lose to a later legal lesson. | Could unstick a learner who left an old session open. | Medium. The precedence is intentional and tested. | Small, but it changes a stated rule. | A learner in the middle of a lesson would be pulled away. |
| 3 | New mastery formula, AI path edits, or a jump over a lock. | Would look more adaptive. | Low. The docs and tests forbid it. | Large. | High. |

### Recommended next step

Stop treating a locked next lesson as a finished path.

When `getNextAction` breaks on a locked published lesson, return `review_concept` for a direct prerequisite of that lesson whose stored score is below 60. Use `getLessonThatTeachesConcept` for the lesson id. Do not start the locked lesson. Do not change `UNLOCK_MASTERY`, `isWeak`, scoring, or revision.

### Acceptance criteria

- Lesson 1 progress `completed`, `web.http` at 59 with two evidence rows, and lesson 2 locked on that prerequisite: the action is `review_concept` for `web.http`, not `path_complete` and not `start_lesson` for lesson 2.
- The same graph with `web.http` at 30 and two evidence rows still reviews `web.http`.
- Every published lesson credited and no weak concept still returns `path_complete`.
- A later module stays unstarted while an earlier lesson is locked.
- The dashboard does not show “Frontend yolunu tamamladın.” while a published lesson remains locked for this reason.

### Exclusions

- Do not change the mastery formula, unlock threshold, weak rule, revision intervals, or exercise scoring.
- Do not let the model reorder lessons or mark a lesson complete.
- Do not skip a locked lesson to a later one.
- Do not add a dependency, a log, a migration, or an AI call.

## Review Concept End-to-End Contract Audit — Step 47.2

Date: 12 October 2026. Audit only. No application source, curriculum data, schema, seed, or test was changed. Browser verification was not performed. No database query or reseed was run.

Status: **PASS WITH NOTES**

### Files inspected

- `packages/curriculum/src/next-action.ts`, `next-action.spec.ts`
- `packages/curriculum/src/graph.ts`, `learning-catalog.ts`, `learning-catalog.spec.ts`, `personalized-path.ts`
- `packages/types/src/learning.ts`, `packages/types/src/learning-catalog.ts`, `packages/types/src/teaching-session.ts`
- `packages/database/src/teaching-repository.ts`
- `apps/api/src/modules/learning/learning-catalog.service.ts`
- `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/admin/admin.service.ts`
- `apps/web/lib/api/server.ts`, `apps/web/lib/copy.ts`
- `apps/web/lib/learning/dashboard.ts`, `dashboard.spec.ts`, `catalog-view.ts`
- `apps/web/lib/teaching/workspace.ts`
- `apps/web/components/dashboard/dashboard-view.tsx`
- `apps/web/components/curriculum/path-list.tsx`, `path-rail.tsx`
- `apps/web/components/homework/homework-board.tsx`
- `apps/web/components/teaching/lesson-experience.tsx`
- `apps/web/app/app/(study)/dashboard/page.tsx`
- `apps/web/app/app/(study)/learn/page.tsx`, `apps/web/app/app/(study)/learn/[lessonSlug]/page.tsx`

### Command run

`pnpm --filter @platform/curriculum exec vitest run src/next-action.spec.ts`

Result: 1 file, 7 tests, passed. These tests cover the producer only.

### End-to-end path

`getNextAction` returns `review_concept` with three fields: `conceptSlug`, `lessonId`, and `title`. There is no concept id and no reason field. `lessonId` is the earliest published lesson whose primary concepts include that slug (`getLessonThatTeachesConcept`). The same object is returned by the catalog (`presentLearningCatalog`), the current-user profile, and the admin student view. The API sends it through as JSON. The web catalog guard accepts any object whose `kind` is one of the five action kinds. It does not require `conceptSlug`, `lessonId`, or `title`.

For a locked next lesson whose blocking prerequisite is below 60, the catalog marks the teaching lesson `current`. That check runs before the completed-progress check, so a lesson the learner already finished becomes the current lesson again. The locked lesson stays `locked`. The path list links only `current` and practice lessons, so the locked lesson has no link.

The dashboard hero uses that current lesson:

- Eyebrow: “Təkrarlanmalı”.
- Title: the teaching lesson title.
- Description: that lesson’s objective.
- Button: “Konsepti təkrarla”.
- Link: `/app/learn/{teaching-lesson-slug}`.

The completion sentence “Frontend yolunu tamamladın.” is used when the kind is `path_complete`. A well-formed `review_concept` whose lesson is in the catalog does not use it.

The lesson page allows the teaching lesson because its availability is `current`. `LessonExperience` then posts `/api/v1/teaching/sessions` with an empty body. The page slug is not sent. `openSession` loads `getNextAction` again. `review_concept` is handled by the same branch as `start_lesson`: find `lessonId`, require the lesson to be published and unlocked, then create a new teaching session in state `created`. `conceptSlug` is not stored on the session and is not sent to the teacher. After the session exists, the refreshed action is `continue_lesson` for that session.

If the opened session’s lesson slug differs from the page, the client replaces the URL with the session lesson. When the catalog and `getNextAction` share the same lesson list, that slug is the teaching lesson.

### Prerequisite preservation

The blocking concept is preserved as the lesson that teaches it. The hero link, the path-list link, and the new session all use that lesson. The concept slug itself stops at the action payload. A lesson with several primary concepts is replayed as a whole lesson. There is no separate concept-review screen. Replaying the teaching lesson is the existing destination.

The concept list on the catalog records `lessonSlug` from the first published lesson that mentions the slug, including a supporting mention. The hero uses the current lesson first, which is `lessonId`, so the primary click follows the primary teaching lesson. The slug fallback runs only when no lesson is current.

### Step 47.1 scenario

Lesson progress on the earlier lesson can already be `completed` while its primary is missing or below 60. `getNextAction` returns `review_concept` for that prerequisite and the lesson that teaches it. The dashboard shows the review button and the teaching lesson, and the locked lesson stays locked. Opening the session succeeds when that teaching lesson is itself unlocked, which is true when the teaching lesson has no taught prerequisite below 60. The first-lesson case in `next-action.spec.ts` is this shape.

### Confirmed gaps

1. Session open and the catalog can disagree. Recovery may name an earlier lesson that is credited because its progress is `completed` while that lesson’s own prerequisites are below 60. The catalog still marks it `current` and the dashboard links to it. `openSession` then rejects it with `LESSON_UNAVAILABLE` because `isLessonUnlocked` fails. The learner reaches the lesson page and the session request fails. The locked later lesson is not opened.

2. The personalized path’s current step is the first uncredited unlocked lesson. In the locked-prerequisite case that step is empty, and the concept strip is empty with it. The path rail does not repeat the hero’s review lesson. It also does not show the completion sentence.

3. A payload that has `kind: "review_concept"` and omits `title`, when no catalog lesson is current, makes the hero title fall through to “Frontend yolunu tamamladın.” The server producer always sends `title`. The web guard would still accept the incomplete object.

### What still holds

A genuinely finished path still returns `path_complete`. The hero link is null and the session opener returns `path_complete` without creating a session. Due homework and an open session still win before the path walk. The unlock threshold and the weak-concept rule are unchanged. When several prerequisites block, the producer still orders a missing score first, then the lowest score, then the concept slug, and uses the earliest primary lesson.

### Test coverage

`next-action.spec.ts` proves the producer: a prerequisite at 59 returns `review_concept` for that concept, a score of 60 starts the next lesson, several prerequisites follow the sort above, a weak concept is unchanged, and a finished path returns `path_complete`.

No catalog test checks that `review_concept` marks the teaching lesson `current` and leaves the locked lesson `locked`. No dashboard test checks the review eyebrow, title, or href. No teaching test opens a session from `review_concept` or covers the `LESSON_UNAVAILABLE` rejection. `learning-catalog.spec.ts` has no `review_concept` case.

### Recommended next step

Make the lesson the dashboard offers and the lesson `openSession` will accept the same lesson. When `review_concept` names a teaching lesson that is locked, keep the later lesson locked and do not present a link that the session opener rejects. Keep using the existing lesson session. A concept-specific review mode is a separate product decision.

The follow-up tests should cover the catalog availability, the dashboard hero for this payload, and the session open for an unlocked teaching lesson. This audit did not add them.

### Exclusions

- Unlock stays 60. The weak rule, mastery, homework priority, open-session priority, and curriculum order stay as they are.
- This step does not add an action kind or a review mode.

## Review Destination and Session Consistency — Step 47.3

Date: 12 October 2026.

Status: **PASS WITH NOTES**

### Root cause

`review_concept.lessonId` came from the earliest published lesson that teaches the concept as a primary. Published is not the session check. `openSession` accepts that lesson only when it is published and `isLessonUnlocked` is true. A completed lesson can still be locked when one of its own taught prerequisites is below 60. The catalog then marked that lesson current, the dashboard linked to it, and the session request returned `LESSON_UNAVAILABLE`.

### Files changed

- `packages/curriculum/src/graph.ts`
- `packages/curriculum/src/index.ts`
- `packages/curriculum/src/next-action.ts`
- `packages/curriculum/src/next-action.spec.ts`
- `packages/curriculum/src/learning-catalog.ts`
- `packages/curriculum/src/learning-catalog.spec.ts`
- `packages/curriculum/src/personalized-path.ts`
- `apps/web/lib/learning/dashboard.ts`
- `apps/web/lib/learning/dashboard.spec.ts`

### How the lesson matches the opener

The destination is a published lesson that teaches the concept as a primary and passes `isLessonUnlocked`, the same check `openSession` already uses. The opener was not changed. Among those lessons, the earliest wins: module position, then lesson position, then slug. A lesson after the locked lesson is not chosen.

The concept slug stays the direct blocking prerequisite when one of those lessons exists. If every lesson that teaches that concept is locked, the same score order continues along the prerequisites that make the teacher locked, and the action uses the first concept on that chain that has an eligible lesson. The locked next lesson stays locked. The path rail’s current step is that same lesson, so its existing link matches the dashboard.

A missing or blank `title` uses the existing action label. It does not use “Frontend yolunu tamamladın.” A review payload whose lesson is not the current catalog lesson has no hero link, so it does not follow a different concept lesson.

### Concept slug and the teaching session

`conceptSlug` remains on the action and is returned by the catalog, profile, and admin views. Opening a session still creates an ordinary lesson session. The teaching API does not receive or use the slug. This step does not add a review mode.

### Verification

- `pnpm --filter @platform/curriculum exec vitest run` — 26 files, 146 tests, passed
- `pnpm --filter @platform/web exec vitest run lib/learning/dashboard.spec.ts` — 7 tests, passed
- `pnpm --filter @platform/api exec vitest run src/modules/teaching/teaching.http.spec.ts` — 12 tests, passed
- ESLint on the changed curriculum and dashboard files — passed
- `pnpm --filter @platform/curriculum exec tsc -p tsconfig.json --noEmit` — passed
- `pnpm --filter @platform/web typecheck` — failed in duplicate generated files under `apps/web/.next/types` (`cache-life.d 2.ts`, `routes.d 2.ts`). Those duplicates were removed. `pnpm exec tsc --noEmit -p tsconfig.json` in `apps/web` then passed.

Browser verification was not performed.

### Remaining limitation

The session still teaches the whole lesson. It does not focus the concept slug. A lock that `isLessonUnlocked` cannot explain still reaches `path_complete`; the current unlock rule does not produce that lock, because a locked lesson has a taught prerequisite below 60 and that chain ends at an earlier lesson the opener accepts.

## Concept-Focused Review Feasibility Audit — Step 47.4

Date: 12 October 2026. Audit only. No application source, test, curriculum data, schema, or seed was changed. No test suite was re-run. Browser verification was not performed.

Status: **PASS WITH NOTES**

### Files and functions inspected

- `apps/web/lib/learning/dashboard.ts` — `hero`, `heroHref`
- `apps/web/lib/learning/catalog-view.ts` — `lessonHref`
- `apps/web/app/app/(study)/learn/[lessonSlug]/page.tsx`
- `apps/web/components/teaching/lesson-experience.tsx` — `openSession`, `applyOpen`
- `apps/api/src/modules/teaching/teaching.controller.ts` — `open`, `turn`
- `apps/api/src/modules/teaching/teaching.orchestrator.ts` — `open`, `turn`, `invoke`, `assemblePrompt`
- `packages/validation/src/teaching.ts` — `openTeachingSessionSchema`, `teachingTurnSchema`
- `packages/database/src/teaching-repository.ts` — `openSession`, `nextActionFrom`, turn commit, `loadSnapshot`
- `packages/database/prisma/schema.prisma` — `TeachingSession`, `TeachingMessage`
- `packages/curriculum/src/next-action.ts` — `getNextAction`
- `packages/curriculum/src/teaching-flow.ts` — `currentTeachingBlock`, `publicLessonBlock`
- `packages/curriculum/src/teaching-state.ts` — `resolveTeachingTransition`
- `packages/curriculum/src/mastery.ts` — `selectSkillUpdates`
- `packages/curriculum/src/adaptive.ts` — `decideAdaptive`
- `packages/ai/src/context/teacher-context.ts` — `buildTeacherContext`, `adaptiveChoice`
- `packages/ai/src/prompts/teacher/v1/teach.ts` — `renderTeachPrompt`
- `packages/ai/src/prompts/teacher/v1/system.ts` — `TEACHER_SYSTEM_PROMPT`
- `packages/types/src/teacher.ts` — `TeacherContext`
- `packages/types/src/learning.ts` — `NextAction`, `LessonBlock`

### Current contract

The dashboard link is `/app/learn/{lesson slug}` from the catalog lesson marked current. The URL has no concept slug. `LessonExperience` posts `/api/v1/teaching/sessions` with `{}`.

`openTeachingSessionSchema` accepts only an optional `mode` of `explain` or `socratic`. A body that includes `lessonId` fails validation. The controller passes that mode, defaulting to `explain`, into `openSession`.

`openSession` calls `getNextAction`. For `review_concept` it uses the same branch as `start_lesson`: the lesson must be published and unlocked, then it inserts a `TeachingSession` with `userId`, `lessonId`, `mode`, `state: "created"`, and `turnCount: 0`. The row has no concept field. After the insert, `getNextAction` runs again and returns `continue_lesson` for the new open session. The review slug is gone from later reads.

Each turn loads that row in `loadSnapshot`. `assemblePrompt` picks the current block with `currentTeachingBlock` from the lesson state and used checks. It does not read a review slug. `buildTeacherContext` puts the lesson, block, concepts, and prerequisites into `TeacherContext`. `adaptiveChoice` sets the adaptive concept to the lesson’s first primary, then `decideAdaptive`. `renderTeachPrompt` puts that packet in the user prompt and uses the fixed system prompt `teacher.system.v3`. The provider call is that system string plus that user string.

The session is persisted. Resume and refresh call open again, find the open session, and continue it. Recent messages and `summary` come from the row. `summary` is not where a review focus can live: it is teacher-facing session text, and the row has no other metadata field. `TeachingMessage.payload` stores progress marks for one turn.

A provider failure calls `failTurn` and does not write a teacher message. There is no focus field to drop. The next successful turn rebuilds the prompt from the lesson and the session row.

Skill updates are filtered by `selectSkillUpdates` to the lesson’s concepts and the direct prerequisite slugs on the snapshot. A learning event is written only for a slug that resolves to a concept id. Lesson progress becomes `completed` only when the existing state machine reaches `completed`, which still requires the recap and homework marks. The model’s `suggestedState` cannot unlock a lesson or set mastery by itself.

`currentTeachingBlock` can send a check question’s rubric to the model inside the trusted packet. The learner-facing block from `publicLessonBlock` keeps the prompt and omits the rubric. Exercise hidden tests are not part of this prompt.

### Can the existing engine do this?

Yes. The lesson id remains the session lesson. The state machine, unlock check, scoring, and mastery writes stay as they are. The missing piece is a server-owned focus that survives after `getNextAction` switches to `continue_lesson`.

Putting `conceptSlug` on the open request is not enough. The client does not send it today, and the server would have to ignore a client value anyway. The only reliable moment to capture it is inside `openSession`, from the `review_concept` result, before the new session hides that result. A later turn cannot recover it from `getNextAction`.

`mode` cannot store it. The phase-1 modes are `explain` and `socratic`, and any other mode throws before the provider call.

### Recommended implementation

Add one nullable server field on `TeachingSession` for the focus slug. Set it only when `getNextAction` returns `review_concept` and that slug is a primary concept of the lesson just opened. Leave it null for `start_lesson` and `continue_lesson`. Do not accept the slug from the request body.

On each turn, `loadSnapshot` reads the field. If it is still a primary of that lesson, `assemblePrompt` adds it to the trusted packet as the focus, with the concept name from the lesson. `renderTeachPrompt` tells the teacher to explain, question, and practice that concept inside the current lesson. `adaptiveChoice` uses that slug instead of the first primary. If the field is null or no longer a primary of the lesson, omit it and keep today’s prompt.

Do not change `currentTeachingBlock` in the first version unless a block’s own `conceptSlugs` contain the focus. Otherwise keep the normal block. Do not add a second session type, and do not change unlock, weak selection, scoring, homework priority, or the destination rules from Step 47.3.

The state machine still completes the lesson when recap and homework are done. A focused review that walks the whole lesson can still complete it and can still write mastery through the existing skill-update filter. That is the current reopen behavior. The focus must not add another way to write evidence or to mark the lesson complete.

### Edge cases

| Case | Confirmed behavior |
| --- | --- |
| Slug is not a primary of the selected lesson | Today it is never stored. The destination rule only emits a primary of the eligible lesson. A stored slug that fails that check on a later turn should be ignored. |
| Prerequisite that is not a primary of this lesson | Not a current `review_concept` target. Do not accept it as focus. |
| Refresh or a second open | Returns the existing session as `continue_lesson`. Without a stored slug, the focus cannot be rebuilt. |
| Normal open | `start_lesson` or `continue_lesson`. Focus stays null. The prompt keeps the first primary. |
| Stale slug | Ignore it when it is not a primary of the session lesson. Teach the normal lesson. |
| Provider failure | `failTurn` does not rewrite the session lesson, mode, or state. A column on the session would remain. |
| Mastery and completion | Still require the existing skill-update filter and the existing transition into `completed`. |

These conclusions come from the source. This step did not open a live session.

### Tests for a later implementation

- Opening from `review_concept` stores the server slug on that lesson, and the teach prompt names it.
- A client-supplied slug or lesson id is ignored or rejected. The stored slug is the server’s.
- A normal `start_lesson` session has no focus, and its prompt still uses the first primary.
- Reloading the open session keeps the slug in the next prompt.
- A slug that is not a primary of the lesson is omitted.
- An unrelated skill update is still dropped. Completion still follows the current state machine.
- Existing next-action, unlock, and teaching-session tests stay green.

### Exclusions

- Do not change the unlock threshold, weak rule, mastery math, exercise scoring, or homework and open-session priority.
- Do not let the model mark mastery or unlock a lesson.
- Do not show hidden tests, expected answers, or private evaluation data to the learner.

## Persisted Concept-Focused Review — Step 47.5

Date: 12 October 2026.

Status: **PASS WITH NOTES**

### Files changed

- `packages/database/prisma/schema.prisma` — nullable `TeachingSession.reviewConceptSlug`
- `packages/database/prisma/migrations/20261012150000_teaching_session_review_concept/migration.sql` — `ALTER TABLE "teaching_sessions" ADD COLUMN "review_concept_slug" TEXT`
- `packages/database/src/generated/prisma` — regenerated by `prisma generate`
- `packages/database/src/review-focus.ts`
- `packages/database/src/review-focus.spec.ts`
- `packages/database/src/teaching-repository.ts`
- `packages/types/src/teacher.ts`
- `packages/ai/src/context/teacher-context.ts`
- `packages/ai/src/context/teacher-context.spec.ts`
- `packages/ai/src/prompts/teacher/v1/teach.ts`
- `packages/ai/src/prompts/teacher/v1/prompt.spec.ts`
- `packages/validation/src/teaching.spec.ts`
- `apps/api/src/modules/teaching/teaching.orchestrator.ts`
- `apps/api/src/modules/teaching/teaching.http.spec.ts`

The migration adds one nullable text column. Existing session rows stay valid with the column null. Historical learning events were not rewritten, and existing sessions were not reset. `prisma migrate deploy` applied `20261012150000_teaching_session_review_concept`.

### How the review slug is selected, validated, persisted, and taught

`openSession` still calls `getNextAction`. The slug is taken only from that server result. A `review_concept` action is stored when `conceptSlug` is a primary concept of the exact lesson that action selected. A `review_concept` whose slug is not a primary of that lesson throws the existing `409 LESSON_UNAVAILABLE` and does not insert a session. `start_lesson` stores null. `continue_lesson` returns the existing row, so a refresh or a second open keeps the stored slug.

The open and turn schemas stay strict. A client `conceptSlug` fails validation and cannot replace the stored focus. The public session view does not include the slug or the teacher packet.

Each turn reads `review_concept_slug` from the session. `loadSnapshot` keeps it only when it is still a primary of that lesson. `buildTeacherContext` puts that concept on the trusted lesson packet as `reviewFocus` and uses it as the adaptive concept, including that concept’s mastery and prerequisite weakness. `renderTeachPrompt` tells the teacher to explain, ask, and practice that concept inside the current lesson, and to leave mastery, scores, unlocks, and exercise results alone. The prompt versions stay `teacher.teach.v2` and `teacher.system.v3`. A missing or non-primary slug is omitted. The turn then uses the lesson’s first primary, as an ordinary lesson does. The column is left in place.

`failTurn` updates only the pending claim. It does not write a teacher message and does not clear the focus. Turn commit still follows the existing state machine. Skill updates still go through `selectSkillUpdates`. A suggested state of `completed` does not finish the lesson early.

### Normal sessions

A session opened as `start_lesson` has `reviewConceptSlug` null. Its teach prompt has no review-focus line, and the adaptive concept remains the lesson’s first primary.

### Verification

- `pnpm exec prisma validate` in `packages/database` — schema valid
- `pnpm exec prisma generate` in `packages/database` — client generated
- `pnpm exec prisma migrate deploy` in `packages/database` — applied `20261012150000_teaching_session_review_concept`; 16 migrations, all applied
- `pnpm exec vitest run src/review-focus.spec.ts` in `packages/database` — 3 passed
- `pnpm exec vitest run` in `packages/database` — 8 files, 14 tests, passed
- `pnpm exec vitest run src/context/teacher-context.spec.ts src/prompts/teacher/v1/prompt.spec.ts` in `packages/ai` — 13 passed
- `pnpm exec vitest run` in `packages/ai` — 16 files, 96 tests, passed
- `pnpm exec vitest run` in `packages/validation` — 7 files, 29 tests, passed
- `pnpm exec vitest run` in `packages/curriculum` — 26 files, 146 tests, passed
- `pnpm exec vitest run src/modules/teaching/teaching.http.spec.ts` in `apps/api`, with the repo `.env` loaded — 13 passed
- `pnpm exec turbo run typecheck --filter=@platform/database --filter=@platform/ai --filter=@platform/types --filter=@platform/validation --filter=@platform/api` — 13 tasks successful
- ESLint on the changed database, AI, validation, types, and API files — passed

Browser verification was not performed. The API was not opened in a browser, and a live learner turn with the real model was not run.

### Remaining limitations

The HTTP suite checks the scripted teacher request. It confirms the persisted slug is in the trusted prompt and is the adaptive concept. It does not show that a real model then teaches that concept in the learner UI. A focused review that walks the existing lesson can still reach `completed` when recap and homework are done. That is the current lesson state machine. This step adds no separate completion path. Check-question rubrics remain in the trusted block packet, as they did before this step. Hidden tests and expected sandbox answers are not added to the prompt. Unlock threshold, weak rule, mastery math, scoring, and homework priority are unchanged.

## Review Flow End-to-End Acceptance — Step 47.6

Date: 12 October 2026.

Status: **PASS WITH NOTES**

### Files changed

- `apps/api/src/modules/teaching/teaching.http.spec.ts`
- `apps/web/components/dashboard/dashboard-view.spec.tsx`
- `apps/web/components/teaching/lesson-experience.spec.tsx`
- `apps/web/lib/learning/catalog-view.spec.ts`

No application code changed. The traced path matches the existing handlers.

### Learner path

A learner with lesson progress completed and `web.http` at 59 gets `review_concept` for `web.http` on `how-the-web-delivers-a-page`. The catalog marks that lesson current and `what-a-url-is` locked. The dashboard hero uses the review label and links to `/app/learn/how-the-web-delivers-a-page`. The lesson page opens that slug. `LessonExperience` posts `{}`. The created session is that lesson, and `review_concept_slug` is `web.http`. The first turn’s trusted context uses that slug as the review focus and as the adaptive concept. A second open returns the same session. After the session exists, the catalog action becomes `continue_lesson` for the same lesson, and the stored slug remains. A client `conceptSlug` is rejected. A stale slug is omitted from the teacher context and the column stays. A provider failure writes no teacher message and leaves the slug. The locked lesson is not the session lesson.

A normal open, before that mastery row, is `start_lesson` with a null review slug and no review-focus line. `path_complete` still renders the completion sentence and no lesson link.

### Tests and commands

- `pnpm exec vitest run src/modules/teaching/teaching.http.spec.ts` in `apps/api`, with the repo `.env` loaded — 1 file, 13 tests, passed
- `pnpm exec vitest run lib/learning/catalog-view.spec.ts lib/learning/dashboard.spec.ts components/dashboard/dashboard-view.spec.tsx components/teaching/lesson-experience.spec.tsx` in `apps/web` — 4 files, 18 tests, passed
- `pnpm exec tsc -p tsconfig.json --noEmit` in `apps/api` — passed
- `pnpm exec tsc --noEmit -p tsconfig.json` in `apps/web` — passed
- ESLint on the four changed test files — passed

### Browser and live model

Browser verification was not performed. `http://127.0.0.1:3000` and `http://127.0.0.1:3001` were not accepting connections. No live-model smoke test was run. The teacher context includes the concept name, the focus instruction, and the adaptive concept. That is enough for the model to focus explanations, questions, and practice. This step does not claim the model then teaches that concept.

### Defects

No learner-facing defect was confirmed. The dashboard link, the lesson page, and the session lesson are the same lesson.

### Completion semantics

Focused review uses the existing lesson state machine. `created` moves to `prior_check`, then `objective`, `explain`, and `comprehension_check`. Later states reach `summarize`, then `homework`. The session becomes `completed` only from `homework` when the recap is summarized and homework is persisted. Lesson progress is marked completed only in that case. A model `suggestedState` of `completed` does not skip those steps. The review slug does not change transitions, scores, or unlocks.

A learner who walks that whole lesson can still complete it. If the review lesson was already completed, the progress row is written completed again. The next lesson stays locked until mastery reaches the existing threshold through the existing skill-update filter. Product clarification is needed before changing that: the button says “Konsepti təkrarla”, while the session can still finish the lesson under the normal recap and homework rules. This step leaves those rules as they are.

## Focused Review Lifecycle Design Audit — Step 47.7.1

Date: 12 October 2026.

Status: **PASS WITH NOTES**

This step only reads the current source and records the implementation plan. No application code, tests, schema, migrations, curriculum, or seeds were changed. No test, typecheck, lint, or database command was run.

### Files and symbols inspected

- `packages/curriculum/src/teaching-state.ts` — `resolveTeachingTransition`, `forcedTarget`, `isOpenTeachingState`
- `packages/curriculum/src/teaching-flow.ts` — `advanceTeachingProgress`, `currentTeachingBlock`, `publicLessonBlock`, `teachingTurnNeedsAnswer`
- `packages/curriculum/src/teaching-state.spec.ts`, `packages/curriculum/src/teaching-flow.spec.ts`
- `packages/curriculum/src/next-action.ts` — `getNextAction` open-session filter
- `packages/curriculum/src/mastery.ts` — `selectSkillUpdates`
- `packages/curriculum/src/exercise-validator.ts` — `evaluateExercise`, `exerciseMasteryUpdate`, `EXERCISE_PASS_SCORE` (70)
- `packages/ai/src/safety/normalize-teacher-result.ts` — `normalizeTeacherTurn`
- `packages/ai/src/prompts/teacher/v1/teach.ts` — `renderTeachPrompt`
- `packages/database/src/teaching-repository.ts` — `openSession`, turn commit, `failTurn`, `loadSnapshot`, `sessionView`, `incrementTeacherTurn`, `phase1Mode`
- `packages/database/src/review-focus.ts` — `newSessionReviewFocus`, `reviewSlugIfPrimary`
- `packages/database/src/exercise-repository.ts` — passed-attempt learning event
- `packages/database/src/progress-repository.ts` — `writeSkillMasteryProjection`
- `packages/database/prisma/schema.prisma` — `TeachingState`, `TeachingMode`, `ProgressStatus`, `TeachingSession.reviewConceptSlug`
- `packages/types/src/learning.ts` — `TeachingState`
- `packages/types/src/teaching-session.ts` — `TeachingSessionView.completed`, `TeachingTurnResponse`
- `apps/api/src/modules/teaching/teaching.orchestrator.ts` — `assemblePrompt`, `allowedConceptSlugs`, `failTurn`
- `apps/web/lib/teaching/presentation.ts` — `composerMode`, `stateLabel`, `advanceLabel`
- `apps/web/lib/teaching/workspace.ts` — `completion`, `buildLessonWorkspace`
- `apps/web/components/teaching/lesson-experience.tsx` — open `{}`, completion refresh
- `apps/web/lib/copy.ts` — `teacher.phase.completed`, `teacher.completedTitle`, `teacher.pathDone`

### Current behavior

`TeachingState` is `created`, `prior_check`, `objective`, `explain`, `comprehension_check`, `adapt`, `exercise`, `evaluate`, `hint`, `raise_difficulty`, `summarize`, `homework`, `completed`, `abandoned`. `resolveTeachingTransition` forces the next state for almost every step. A model `suggestedState` is accepted only in the two choice points (`prior_check` when socratic and correct, and `evaluate` when correct and a harder check remains). `suggestedState: "completed"` does not jump to the end.

The ordinary path is `created` → `prior_check` → `objective` → `explain` → `comprehension_check`. A correct answer with another check goes to `exercise`, then `evaluate`. A correct evaluation with no harder check goes to `summarize`, then `homework`. `homework` becomes `completed` only when the progress marks say the recap was summarized and homework was persisted. `advanceTeachingProgress` sets `recapSummarized` when leaving `summarize` or when the target is `completed`. Entering `homework` creates a `HomeworkAssignment`.

Lesson completion is one write. In the turn commit, `completed` means `input.state === "completed"`. That flag sets `endedAt`, upserts `lesson_progress.status` to `completed`, and adds 1 to `daily_activity.lessons_completed`. `sessionView.completed` is `session.state === "completed"`. The web app treats that state as done: `composerMode` returns `done`, the phase label is “Dərs tamamlandı”, and `completion()` titles the card “Dərs tamamlandı”. If the following action is `path_complete`, the body is “Frontend yolunu tamamladın.”

`review_concept_slug` is set only in `openSession`, and only when `getNextAction` is `review_concept` and the slug is a primary of that lesson. Otherwise the column is null. A mismatch throws `409 LESSON_UNAVAILABLE` and inserts nothing. `continue_lesson` returns the existing row. `failTurn` updates the pending claim and does not clear the column. Turn commit does not clear it. `loadSnapshot` passes the slug to the teacher only when it is still a primary; a stale value stays in the column and is omitted from the prompt. The client cannot send the slug. `TeachingMode` already has `revision`, but `phase1Mode` reads anything other than `socratic` as `explain`, and `renderTeachPrompt` rejects every mode except `explain` and `socratic`. Mode cannot store the review purpose.

A review session today uses that same state machine. Reaching `completed` marks the lesson completed.

Teacher skill updates go through `selectSkillUpdates`. The allowed set is the lesson concepts plus direct prerequisite slugs. Unknown slugs and a raw mastery number are dropped. A learning event is written only when the slug resolves to a concept id, with source `lesson_check` or `homework`. Exercise evidence is separate: `exercise-repository` writes an `exercise` learning event only when the attempt passed and `exerciseMasteryUpdate` accepts the score, which requires an integer score of at least 70. Both paths then call `writeSkillMasteryProjection`. Unlock stays at 60. An open session is one with `endedAt` null and a state other than `completed` or `abandoned`.

### Intended behavior

“Konsepti təkrarla” starts a review of the server-selected concept inside the existing session. The review ends on its own. That ending does not write lesson progress as completed, does not create homework, does not increment lessons completed, and does not show “Dərs tamamlandı” or “Frontend yolunu tamamladın.” Ordinary `start_lesson` and `continue_lesson` sessions keep the current machine. Mastery math, exercise scoring, and the unlock threshold stay as they are.

### Smallest safe plan

Keep one session engine and the modes `explain` and `socratic`.

Use a non-null `review_concept_slug` as the server-owned purpose. It is already written only for `review_concept`, and it is not cleared when the slug later fails validation. A null column remains an ordinary lesson. Do not add a second purpose column. Do not use `TeachingMode.revision`. The implementation must not null the column when the focus is stale, or the purpose disappears.

Add one terminal state, `review_completed`, to the `TeachingState` enum and the TypeScript union. `session.completed` stays true only for `completed`. `review_completed` is closed: `isOpenTeachingState` is false, `endedAt` is set, and the open-session query treats it like `completed` and `abandoned`. The lesson-progress write remains `state === "completed"`, so this new state does not need a special exception in that write.

For a session whose column is non-null, `resolveTeachingTransition` gets a review flag. The path may still run `created` → `prior_check` → `objective` → `explain` → `comprehension_check`, including the existing adapt loop for an incorrect or partial answer. A correct understanding at `comprehension_check` goes to `review_completed` instead of `exercise` or `summarize`. `summarize`, `homework`, and `completed` are not targets. No homework row is created. Provider failure still calls `failTurn` and leaves the state and the slug. Abandon still sets `abandoned`.

`currentTeachingBlock` for a review question state should prefer a `check_question` whose `conceptSlugs` contain the validated slug, then a reading that contains it. It should not select the recap block. If no block lists the concept, keep the normal block and still apply the review ceiling.

On each review turn, the teacher’s allowed skill slugs are the validated review slug only. Co-primaries and other prerequisites on the same lesson do not receive check evidence from this session. The update still uses `selectSkillUpdates` and `lesson_check`. The model’s mastery field still has no direct effect. Exercise attempts stay on the exercise route. A real pass at score 70 or above still writes `exercise` evidence and can move mastery. That can unlock the next lesson only through the existing threshold. Review completion itself does not.

The public session can add an optional `reviewConceptName` when the stored slug is still a primary of the lesson. The slug stays off the public body. When the state is `review_completed`, the lesson screen shows a review-finished card and a link back to the dashboard. It does not use `completedTitle`, `pathDone`, or “Növbəti dərsə keç”. `LessonExperience` must not treat `review_completed` as lesson completion.

A stale non-null slug still marks the session as a review, so it cannot reach `completed`. The prompt omits the focus, as it does now. The session does not enter `review_completed` without a validated concept. The learner can abandon it. The lesson progress row is left as it was.

### Schema migration

Yes, one new migration, and only for the enum value:

`ALTER TYPE "teaching_state" ADD VALUE 'review_completed';`

No new table, no change to `review_concept_slug`, and no rewrite of existing rows. Existing null slugs stay ordinary lessons. Sessions already stored as `completed` stay completed; this plan does not repair reviews that already finished the lesson. On PostgreSQL 12 and newer, adding an enum value in its own migration is valid. The new value must not be used in the same migration statement.

### Tests to add later

- `packages/database/src/review-focus.spec.ts` — null slug is an ordinary session; a review slug is kept only for a primary of the selected lesson; a non-primary review action is rejected.
- `packages/curriculum/src/teaching-state.spec.ts` — with the review flag, a correct comprehension check ends at `review_completed`; summarize, homework, and `completed` are unreachable; an incorrect answer still adapts; a suggested `completed` does not finish the review; without the flag, the current transitions stay the same.
- `packages/curriculum/src/next-action.spec.ts` — `review_completed` is not an open session; a locked next lesson is not `start_lesson` while mastery is below 60; `path_complete` is unchanged.
- `apps/api/src/modules/teaching/teaching.http.spec.ts` — review creation persists the server slug; the first turn names that concept; resume and refresh keep it; a client slug is rejected; a normal session has a null slug and can still reach recap, homework, and `completed`; review end does not set lesson progress to `completed`, does not create homework, and does not increment lessons completed; the next lesson stays locked; a passed exercise still writes exercise evidence; a model mastery claim does not set the score by itself; provider failure keeps the slug and writes no teacher message; a stale slug does not complete the lesson.
- `apps/web/lib/teaching/presentation.ts` tests and `apps/web/lib/teaching/workspace.ts` tests — `review_completed` is done, with review copy, and without “Dərs tamamlandı” or the path-complete sentence. `apps/web/components/dashboard/dashboard-view.spec.tsx` keeps the review link distinct from path completion.

### Risks and decisions

The recommended end is one correct understanding of the focused check. A longer review would be a later change. In-flight review rows created before the enum exists will follow the new ceiling on their next turn. Rows already `completed` are left alone. Returning `reviewConceptName` is additive. The public state union grows by one value, so every state switch in the web app and the open-session filters must handle it. A stale review can be abandoned and cannot be completed as a lesson; it also cannot finish as a successful review until the slug is valid again.

### Commands

None. The findings come from the source listed above.

## Focused Review Lifecycle Implementation — Step 47.7.2

Date: 12 October 2026.

Status: **PASS WITH NOTES**

### Files changed

- `packages/database/prisma/schema.prisma` — `TeachingState.review_completed`
- `packages/database/prisma/migrations/20261012170000_teaching_state_review_completed/migration.sql` — `ALTER TYPE "teaching_state" ADD VALUE 'review_completed';`
- `packages/database/src/generated/prisma` — regenerated by `prisma generate`
- `packages/database/src/teaching-repository.ts`
- `packages/types/src/learning.ts`
- `packages/types/src/teaching-session.ts`
- `packages/curriculum/src/teaching-state.ts`
- `packages/curriculum/src/teaching-state.spec.ts`
- `packages/curriculum/src/teaching-flow.ts`
- `packages/curriculum/src/teaching-flow.spec.ts`
- `packages/curriculum/src/next-action.ts`
- `packages/curriculum/src/next-action.spec.ts`
- `packages/ai/src/safety/normalize-teacher-result.ts`
- `packages/ai/src/safety/normalize-teacher-result.spec.ts`
- `apps/api/src/modules/teaching/teaching.orchestrator.ts`
- `apps/api/src/modules/teaching/teaching.http.spec.ts`
- `apps/web/lib/copy.ts`
- `apps/web/lib/teaching/presentation.ts`
- `apps/web/lib/teaching/workspace.ts`
- `apps/web/lib/teaching/workspace.spec.ts`
- `apps/web/components/teaching/lesson-experience.spec.tsx`
- `apps/web/components/teaching/lesson-workspace.spec.tsx`

The migration contains only the enum addition. It does not use the new value, and it does not update existing rows. `prisma migrate deploy` applied `20261012170000_teaching_state_review_completed`. Seventeen migrations are applied. Sessions already stored as `completed` stay `completed`.

### Transition

A non-null `review_concept_slug` is the review purpose. `loadSnapshot` still validates it against the lesson primaries and does not clear the column when validation fails.

`resolveTeachingTransition` keeps the existing path through `comprehension_check`, including `adapt` for an incorrect or partial answer. The finish condition is the existing parsed understanding, not a new grader and not the teacher’s speech. When the session is a review, the slug is still a primary, the state is `comprehension_check`, and understanding is `correct`, the next state is `review_completed` instead of `exercise` or `summarize`. A suggested state of `completed` does not choose that ending. `review_completed` is closed: further turns return `409 SESSION_CLOSED`, `endedAt` is set, and open-session selection ignores it. An in-flight review that has already reached `exercise`, `summarize`, or `homework` also ends at `review_completed` on the next turn when the slug is still valid, so it does not create homework. A missing or stale slug stays on the current state and does not enter `review_completed` or `completed`.

Ordinary sessions, whose slug is null, still go from a correct check to `exercise` or `summarize`, then homework, then `completed`.

### Lesson completion and homework

The turn commit still treats lesson completion as `state === "completed"` only. `review_completed` sets `endedAt` and does not upsert `lesson_progress`, does not add to `daily_activity.lessons_completed`, and does not create a `HomeworkAssignment`. `session.completed` stays true only for `completed`. The HTTP review finishes with the lesson’s previous `completedAt` unchanged, homework count 0, and lessons-completed total 0. The next lesson’s progress row is not marked completed.

### Evidence

On a review turn the allowed skill set is the validated review slug alone. A stale review allows none. Updates still pass through `selectSkillUpdates` and are stored as `lesson_check`. The model’s `mastery` field is dropped before parsing. In the HTTP finish, the scripted result carried `mastery: 100` and evidence 90; the stored event is `lesson_check` with evidence 90, and the projected score is 90. Co-primaries and unrelated concepts received no event. Reaching `review_completed` does not write an extra success event. Exercise scoring, the pass threshold of 70, and the unlock threshold of 60 were not changed. A projected score of at least 60 can still unlock the next lesson through that existing rule.

### Session security and the lesson screen

The open and turn schemas stay strict, so the client cannot send a purpose or a concept slug. Opening still uses `getNextAction` and the existing lesson-availability check. Provider failure still updates only the pending claim: the slug remains, no teacher message is written, and the state does not become `review_completed`. A later open does not return the closed review row. `GET` of that row still reports `review_completed`, `completed: false`, and `reviewConceptName` when the slug is still a primary. The slug stays off the public body.

The lesson screen treats `review_completed` as done, with the title “HTTP təkrarı bitdi” when the concept name is known, the body “Bu konsept təkrarı bitdi. Dərs və yol əvvəlki vəziyyətində qalır.”, and a link to `/app/dashboard`. It does not use “Dərs tamamlandı”, “Frontend yolunu tamamladın.”, or “Növbəti dərsə keç”. Ordinary lesson completion copy is unchanged. The lesson page refreshes the outline only when `session.completed` or the state is `completed`, so a finished review does not take that path.

### Verification

- `pnpm exec prisma validate` in `packages/database` — schema valid.
- `pnpm exec prisma generate` in `packages/database` — client generated.
- `pnpm exec prisma migrate deploy` in `packages/database` — applied `20261012170000_teaching_state_review_completed`; all 17 migrations applied.
- `pnpm exec vitest run` in `packages/curriculum` — 26 files, 149 tests passed.
- `pnpm exec vitest run` in `packages/ai` — 16 files, 97 tests passed.
- `pnpm exec vitest run` in `packages/validation` — 7 files, 29 tests passed.
- `pnpm exec vitest run src/review-focus.spec.ts` in `packages/database` — 1 file, 3 tests passed.
- `pnpm exec turbo run build --filter=...@platform/api` — 8 tasks successful.
- `EXECUTION_MODE=fake pnpm exec vitest run src/modules/teaching/teaching.http.spec.ts` in `apps/api`, with the repo `.env` loaded — 1 file, 15 tests passed.
- `pnpm exec vitest run` for `lib/teaching/workspace.spec.ts`, `components/teaching/lesson-workspace.spec.tsx`, `components/teaching/lesson-experience.spec.tsx`, `lib/learning/catalog-view.spec.ts`, `components/dashboard/dashboard-view.spec.tsx`, and `lib/learning/dashboard.spec.ts` in `apps/web` — 6 files, 27 tests passed.
- `pnpm exec tsc --noEmit -p tsconfig.json` in `apps/api` — passed.
- `pnpm exec tsc --noEmit -p tsconfig.json` in `apps/web` — passed. `next typegen` was not run.
- ESLint on the changed TypeScript files in `packages/curriculum`, `packages/ai`, `packages/database`, `packages/types`, `apps/api`, and `apps/web` — passed.
- `curl` to `127.0.0.1:3000` and `127.0.0.1:3001` returned HTTP code 000 and exit 7. The app was not running, so the browser was not opened and no live model turn was sent.

### Notes

The finish signal is the existing understanding value after schema validation. Free-form speech and a suggested `completed` state do not finish the review. A correct check can still record filtered `lesson_check` evidence, and that evidence can move mastery and unlock at 60. Review completion itself does not. Prompt versions stay `teacher.teach.v2` and `teacher.system.v3`. `review_completed` is not in the model’s suggested-state list; an emitted value is recovered to null and the server transition still decides. Rows that were already `completed` before this migration are left as they are.
