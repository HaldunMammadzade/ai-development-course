# API

Base path: `/api/v1`.

Phase 1 is JSON over HTTPS. Teaching turns return one JSON body after the model call. SSE speech deltas are not part of this implementation. The web app calls the API directly with cookies. It does not proxy model traffic.

## Conventions

- Auth is the session cookie described in [security](./security.md).
- Mutating requests require header `X-Requested-With: fetch`.
- Request and response bodies are JSON. Field names are camelCase at the boundary. The database stays snake_case. Mapping lives in the API module.
- Ids in public URLs are UUIDs.
- Timestamps are ISO-8601 UTC.
- List endpoints take `limit` (default 20, max 50) and `cursor`.
- Successful writes return the resource. They do not return a bare `ok: true` when the client needs the new state.

Error body:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily lesson limit reached.",
    "details": { "resetsAt": "2026-10-07T00:00:00.000Z" }
  }
}
```

`message` is safe to show in the UI and is translated by code on the client. The API message is a fallback.

| HTTP | Code                                                                | When                                                                                         |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 400  | VALIDATION                                                          | Zod failed                                                                                   |
| 401  | UNAUTHENTICATED                                                     | Missing or dead session                                                                      |
| 400  | VERIFICATION_INVALID, VERIFICATION_EXPIRED, VERIFICATION_USED       | Email token cannot be consumed. The message does not name an email                           |
| 400  | PASSWORD_RESET_INVALID, PASSWORD_RESET_EXPIRED, PASSWORD_RESET_USED | Reset token cannot be consumed. The message does not name an email                           |
| 403  | FORBIDDEN                                                           | A route that refuses with 403. Teaching sessions of another student are 404                  |
| 403  | EMAIL_UNVERIFIED                                                    | Password matched but the email is unverified, or teaching was requested without verification |
| 403  | CSRF                                                                | Missing requested-with header                                                                |
| 503  | ONBOARDING_UNAVAILABLE                                              | Free plan or Frontend path is not seeded                                                     |
| 404  | NOT_FOUND                                                           | Hidden for rows the user must not know exist; same code as a real miss                       |
| 403  | PLAN_REQUIRED                                                       | Teaching was requested without an active plan                                                |
| 409  | CONFLICT                                                            | Duplicate email, or a teaching turn whose session changed before it was saved                |
| 409  | SESSION_CLOSED                                                      | The session is completed, abandoned, idle for 12 hours, or not a Phase 1 mode                |
| 409  | TURN_IN_PROGRESS                                                    | Another turn on this session is still pending                                                |
| 409  | LESSON_UNAVAILABLE                                                  | The server-selected lesson is not published and unlocked                                     |
| 409  | HOMEWORK_CLOSED                                                     | Homework is skipped or otherwise cannot be completed                                         |
| 429  | RATE_LIMITED                                                        | Burst limit. Not enforced yet                                                                |
| 429  | QUOTA_EXCEEDED                                                      | Daily or monthly teacher-turn cap. A replay or a failed model call does not increment it     |
| 503  | AI_UNAVAILABLE                                                      | The provider failed, timed out, or returned an unusable teacher result. No automatic retry   |
| 503  | RUNNER_UNAVAILABLE                                                  | Phase 2                                                                                      |

Correlation id response header: `X-Correlation-Id`.

## Auth

Implemented routes. Mutating calls require `X-Requested-With: fetch`. The session cookie is never returned in JSON. Registration and a known-account password reset enqueue a transactional email when `EMAIL_PROVIDER` is configured. The JSON body never includes the token. Outside production, those responses still set `X-Development-Verification-Token` or `X-Development-Password-Reset-Token`. Production does not. If the provider is unset or the send fails, the account stays unverified, the reset token stays unused, and the HTTP status does not change to reveal that an account exists.

| Method | Path                           | Auth             | Purpose                                                                                        |
| ------ | ------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/auth/register`               | no               | Create user, preferences, free plan, Frontend enrollment, verification token. `201`. No cookie |
| POST   | `/auth/verify-email`           | no               | Consume the single-use verification token                                                      |
| POST   | `/auth/login`                  | no               | Set the session cookie after the email is verified                                             |
| POST   | `/auth/logout`                 | no               | Revoke the presented session if any, clear the cookie, `204`. Idempotent                       |
| POST   | `/auth/password-reset/request` | no               | Always `202` for a well-formed email. Does not reveal whether it exists                        |
| POST   | `/auth/password-reset/confirm` | no               | Consume the reset token, set the new password, revoke every session                            |
| GET    | `/me`                          | session          | Safe profile, preferences, plan, enrollment, and deterministic `nextAction`                    |
| GET    | `/auth/teaching-access`        | verified session | Authorization probe. `200` only when the email is verified. Not a lesson                       |

Register body. `locale` is optional (`az-AZ`, `en`, `tr`, `ru`; default `az-AZ`). `timezone` is optional and must be an IANA name; the default is `UTC`. Unknown keys are rejected.

```json
{
  "name": "Aysel",
  "email": "aysel@example.com",
  "password": "correct horse battery",
  "locale": "az-AZ",
  "timezone": "Asia/Baku"
}
```

Register response (`201`): `id`, `email`, `name`, `locale`, `timezone`, `emailVerified: false`. Duplicate email is `409 CONFLICT`. An unknown email and a wrong password are the same `401` on login. A correct password before verification is `403 EMAIL_UNVERIFIED` and sets no cookie. A disabled account is the same `401` as a bad password.

Login body: `email`, `password`. Login response is the same safe identity fields with `emailVerified: true`, plus the `Set-Cookie` header.

`GET /me`:

```json
{
  "id": "uuid",
  "email": "aysel@example.com",
  "name": "Aysel",
  "locale": "az-AZ",
  "timezone": "Asia/Baku",
  "emailVerified": true,
  "preferences": { "explanationStyle": "clear", "challengeLevel": "adaptive" },
  "plan": { "code": "free", "dailyTeacherTurns": 40, "monthlyTeacherTurns": 600 },
  "enrollment": { "pathSlug": "frontend", "pathTitle": "Frontend", "status": "active" },
  "nextAction": {
    "kind": "start_lesson",
    "lessonId": "uuid",
    "title": "Brauzer səhifəni necə alır"
  }
}
```

`nextAction` comes from the deterministic learning engine. The model is not asked. Missing, expired, revoked, and disabled sessions all return the same `401 UNAUTHENTICATED` body.

Password reset request body: `{ "email": "aysel@example.com" }`. Response: `{ "status": "accepted" }`. Confirm body: `{ "token": "...", "password": "..." }`. A weak new password is `400` and does not consume the token. Success is `{ "passwordUpdated": true }` and revokes existing sessions.

Rate limits in the security doc are not enforced yet. There is no Redis limiter.

## Learning catalog

Implemented read for the student app. Session and verified email are required. The user comes from the session.

| Method | Path                | Purpose                                                                                    |
| ------ | ------------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/learning/catalog` | Published modules and lessons for the active enrollment, concept mastery, and `nextAction` |

Draft lessons are omitted. Each published lesson is `completed`, `current`, or `locked`. `current` is the lesson `nextAction` would open (`start_lesson`, `continue_lesson`, or `review_concept`). A due homework stays `do_homework` and does not mark that lesson current. The response does not include lesson database ids, evidence, prompts, or provider data. `nextAction` is the same deterministic object as `GET /me`.

```json
{
  "path": { "slug": "frontend", "title": "Frontend", "description": "..." },
  "modules": [
    {
      "slug": "web-fundamentals",
      "title": "Web Fundamentals",
      "description": "...",
      "lessons": [
        {
          "slug": "how-the-web-delivers-a-page",
          "title": "Brauzer səhifəni necə alır",
          "objective": "...",
          "estimatedMinutes": 15,
          "availability": "current"
        }
      ]
    }
  ],
  "concepts": [{ "slug": "web.http", "name": "HTTP", "mastery": null }],
  "nextAction": {
    "kind": "start_lesson",
    "lessonId": "uuid",
    "title": "Brauzer səhifəni necə alır"
  }
}
```

These sketched routes are not implemented: `GET /dashboard`, `GET /paths`, `GET /paths/:slug`, `POST /paths/:slug/enroll`, `GET /lessons/:lessonId`, `PATCH /me/preferences`, `GET /me/skills`. Enrollment still happens at registration.

`nextAction.kind` is one of `do_homework`, `continue_lesson`, `start_lesson`, `review_concept`, `path_complete`.

Lesson blocks of type `check_question` omit `traps` and the full rubric in the student payload. The client shows `prompt` only. Rubrics stay on the server for the teacher context.

There is no public provider route. Teaching routes call the model router internally. They do not expose provider keys, system prompts, or raw model JSON.

## Teaching

Every teaching route requires a live session, an active user, and a verified email. The user id comes from that session. Another student's session is `404`.

| Method | Path                              | Purpose                                                                                  |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------- |
| POST   | `/teaching/sessions`              | Open or restore the session for the lesson `nextAction` selects. Does not call the model |
| GET    | `/teaching/sessions/:id`          | Safe session view for a reload. An idle open session is abandoned on read                |
| POST   | `/teaching/sessions/:id/turns`    | One teaching turn. JSON, not SSE                                                         |
| POST   | `/teaching/sessions/:id/abandon`  | End an open session without completing it                                                |
| GET    | `/teaching/homework`              | The signed-in student's assigned and completed homework                                  |
| POST   | `/teaching/homework/:id/complete` | Mark that student's assigned homework done. Does not call the model                      |

Create body: `{ "mode"?: "explain" | "socratic" }`. The default is `explain`. `lessonId` is rejected. The server uses `nextAction`. A due homework assignment returns `{ "kind": "homework" }` and does not open another lesson. A finished path returns `{ "kind": "path_complete" }`. A new or restored lesson returns `{ "kind": "session", "session": ... }`.

Turn body is exactly one of `message` or `advance: true`, plus a required `clientTurnId` UUID. `message` is trimmed and capped at 2000 characters. Answer states are `prior_check`, `comprehension_check`, and `evaluate`. Other open states require `advance`.

A successful turn returns `session` (`id`, `lessonSlug`, `lessonTitle`, `mode`, `state`, `turnNumber`, `completed`), `teacher` (`message`, `understanding`), `learning` (`updatedConcepts`, `mastery`, `nextAction`), `usage.turnConsumed`, `block`, and `homework`. The same `clientTurnId` returns that stored body and does not call the model again. A failed model call stores the failure on that id. The same id returns the same error, changes no learning state, and does not consume a teacher turn. The server does not retry the provider. The client retries with a new id.

The JSON body is the `teacher.completed` payload. The shared event names for a later stream are `teacher.started`, `teacher.delta`, `teacher.completed`, and `teacher.error`. This step does not open an SSE response. The provider remains one JSON call.

Quota is the free-plan caps on `plans`: 40 teacher turns on the student's calendar day and 600 in that calendar month, using the student's IANA timezone. The counter is `daily_activity.teacher_turns`, incremented only in the same transaction as the successful turn. Exhaustion is `429 QUOTA_EXCEEDED`. A duplicate, a validation failure, a provider failure, a timeout, a malformed result, session creation, and homework completion do not increment it.

A separate burst limit allows 20 successful teaching turns in a rolling 10 minutes per user. The count is teacher messages in that UTC window, plus a fresh pending claim so two concurrent turns cannot both pass. Excess is `429 RATE_LIMITED`. Duplicates, validation failures, failed model calls, homework completion, and session creation do not count.

`teach` is a fast route unless `strength: "strong"` is set on the route config. The default is fast. The free plan's `daily_strong_calls` is 0. When the route is strong, successful `teach` rows in `ai_usage` during the student's IANA day are capped by that number. Failures and duplicate ids do not count. Excess is `429 QUOTA_EXCEEDED`.

Homework completion is `POST /teaching/homework/:id/complete`. The body is ignored. The server writes evidence 80 and weight 1.0 for each concept on that lesson, source `homework`, `sourceId` the homework id. A second call returns the completed row and does not write again. Overdue homework can be completed. Another student's id is `404`.

GET session:

```json
{
  "id": "uuid",
  "lessonSlug": "how-the-web-delivers-a-page",
  "lessonTitle": "Brauzer səhifəni necə alır",
  "mode": "explain",
  "state": "comprehension_check",
  "turnNumber": 4,
  "completed": false,
  "block": { "type": "check_question", "position": 2, "prompt": "..." },
  "messages": [{ "role": "teacher", "speech": "...", "createdAt": "..." }],
  "homework": null,
  "progress": [{ "slug": "web.http", "mastery": 72 }],
  "nextAction": { "kind": "continue_lesson" }
}
```

`check_question` blocks expose `prompt` only. Rubrics stay on the server. Messages are student and teacher speech in chronological order. System prompts are not included. Reading an idle session abandons it and does not refresh `lastActivityAt`. A turn on an abandoned or completed session is `409 SESSION_CLOSED`. Opening a session does not revive an abandoned one.

`GET /teaching/homework` returns `{ homework: [{ id, lessonSlug, lessonTitle, prompt, status, dueAt, completedAt }] }` for the signed-in student only.

## Student web

`apps/web` is the student application. The browser calls `/api/v1` on the web origin. Next rewrites that prefix to the API (`API_INTERNAL_URL`, default `http://127.0.0.1:3001`). The session cookie stays on the web origin. The web app does not call a model, does not open SSE, and does not run code.

| Route                    | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `/login`, `/register`    | Cookie login and registration. Registration does not sign the student in                        |
| `/verify-email`          | Consumes a verification token. A development build can confirm the dev token without showing it |
| `/app/dashboard`         | `GET /me`, the catalog, and homework. The primary button follows `nextAction`                   |
| `/app/learn`             | Published path. Only the `current` lesson can be opened                                         |
| `/app/learn/:lessonSlug` | `POST /teaching/sessions`, then turns. The server picks the lesson                              |
| `/app/homework`          | List and `POST /teaching/homework/:id/complete` with an empty body                              |
| `/app/progress`          | Concept mastery from the catalog. No client-side score                                          |

Answer states (`prior_check`, `comprehension_check`, `evaluate`) send `message`. Other open states send `advance: true`. A new `clientTurnId` is used after any HTTP response. A network failure retries the same id. A failed model call stays sticky on the server, so the next attempt uses a new id.

## Progress

Concept mastery for the enrolled path is `concepts` on `GET /learning/catalog`: `{ slug, name, moduleTitle, mastery, confidence }`. Unseen concepts have `mastery: null` and `confidence: null`. `confidence` is `low`, `medium`, or `high` from the evidence count. The evidence count itself is not returned. `GET /me/skills` is not implemented.

`POST /auth/register`, `POST /auth/login`, and `POST /auth/password-reset/request` return `429 RATE_LIMITED` when the IP or email window is full. The body does not say which window, and it does not repeat the email. A limited password-reset request is `429` for both known and unknown emails. Under the limit, unknown emails still return `202`.

## Exercises

Authored programming exercises live on the lesson the path currently offers, or on a lesson the student has already completed. A later lesson stays unavailable even when its prerequisite scores would otherwise unlock it.

Monaco is an editor, not a code execution environment. For `type: code_text` the student app loads Monaco in the browser and initializes it from `starterCode`. The editor does not score the text and does not send `score`, `passed`, `mastery`, validation rules, hidden tests, or the language. `multiple_choice` stays a list of option ids and labels. An explicit "Yoxla" action is the only write. A lost response retries the same `clientAttemptId`. The next explicit submit after a stored result uses a new id. Resetting the editor to the starter is local and creates no attempt.

`executionAvailable` is `true` only for an authored JavaScript function exercise. Those still use `POST /exercises/:id/attempts`. The API asks the separate runner to run the hidden tests, then scores the observations itself. The runner does not return an authoritative score. A runner outage is `503 EXECUTION_UNAVAILABLE` and stores nothing. A full local queue is `503 EXECUTION_BUSY` and stores nothing. A timeout, syntax error, or runtime error is stored as a failed attempt with score 0 and a short message. Hidden test inputs and expected values are not in `GET` or in the attempt response. The feedback is an aggregate such as `3/3 yoxlama keçdi.` Static `code_text` exercises keep `executionAvailable: false` and the declarative checks.

| Method | Path                             | Purpose                                                                 |
| ------ | -------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/lessons/:lessonSlug/exercises` | Published exercises for an open lesson. Empty rules and answers omitted |
| GET    | `/exercises/:id`                 | Prompt, instructions, starter text, and choice labels                   |
| POST   | `/exercises/:id/attempts`        | `{ clientAttemptId, submission }` only                                  |
| GET    | `/exercises/:id/attempts`        | The signed-in student's own attempts, newest first, at most 20          |
| POST   | `/exercises/:id/review`          | `{ attemptId, clientReviewId, mode }` for a stored JavaScript attempt   |

`GET` never includes validation rules, the correct choice, scores configuration, or another student's submission. A missing, unpublished, or locked exercise is `404` with the same body. An unknown id that is not a UUID is `404` and is not queried.

`POST` body is strict. `score`, `passed`, `mastery`, and any other extra field are `400 VALIDATION`. The submission is at most 4000 characters. A blank submission is stored as a failed attempt with score 0. The same user, exercise, and `clientAttemptId` returns the stored attempt and does not write a second row or a second learning event.

A new attempt is limited to 30 per user per 10 minutes. A replay of an existing `clientAttemptId` does not count. Over the limit the response is `429 RATE_LIMITED`.

A passing attempt (score at least 70) writes one `learning_events` row with `source = exercise` and `sourceId` equal to the attempt id, then recomputes mastery for that exercise's concept. A failing attempt writes no learning event. Submitting an attempt does not call a model.

`POST /exercises/:id/review` explains a stored attempt. `mode` is `explain`, `hint`, or `review`. The server loads the stored source, score, and aggregate pass count. The client cannot send source, a score, or tests. Another student's attempt, a missing attempt, a non-JavaScript exercise, and a locked exercise are `404`. The same user, attempt, `clientReviewId`, and mode returns the stored review and does not call the model again. A new review is limited to 10 per user per 10 minutes (`429 RATE_LIMITED`). If the model is unconfigured or fails, the response is `503 AI_UNAVAILABLE`. The attempt, score, and mastery stay as the execution wrote them. The response is `{ review }` and does not include the prompt, the model, token counts, or hidden tests.

## Projects

A verified student can open a published project only after every required concept has mastery of at least 60. An anonymous request is `401`. An unverified email is `403 EMAIL_UNVERIFIED`. An unpublished project, an ineligible student, a missing slug, and a locked or skipped milestone are `404`. The list omits projects the student cannot open.

| Method | Path                                                        | Purpose                                                                 |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/projects`                                                 | Published projects the student is eligible for                          |
| GET    | `/projects/:projectSlug`                                    | Overview, milestone status, and files for open milestones               |
| POST   | `/projects/:projectSlug/milestones/:milestoneSlug/attempts` | `{ clientAttemptId, files }` only                                       |
| GET    | `/projects/:projectSlug/milestones/:milestoneSlug/attempts` | That student's attempts for an open milestone, newest first, at most 20 |
| POST   | `/projects/:projectSlug/milestones/:milestoneSlug/review`   | `{ attemptId, clientReviewId, mode }` for a stored attempt              |

`files` must be exactly `index.html`, `style.css`, and `script.js`. Each file is at most 4000 characters. The three files together are at most 8000 characters. A null byte, an extra filename, a path, `package.json`, `score`, `passed`, or any other extra field is `400 VALIDATION`. Locked milestones omit instructions and files.

Milestone order is enforced in the database transaction. The first passing attempt for a milestone writes `project_milestone_progress` and one `learning_events` row with `source = project`. A replay of the same `clientAttemptId` returns the stored attempt and does not execute again or write another event. A later failing attempt does not clear the pass. HTML and CSS milestones do not call the runner. The greeting milestone sends only `script.js` to the existing runner. A runner failure stores nothing. At most four exercise and project executions are claimed together.

`POST .../review` uses the stored files. It does not accept editor contents, a score, or tests. The model task is `project_review`, limited to 10 new reviews per user per 10 minutes in a separate rate bucket from exercise reviews. The response is `{ review }`. If the model is unavailable, or its output is a full page or function, the response is `503 AI_UNAVAILABLE` and the attempt is unchanged.

## Interviews

A verified student can open a published interview only after every required concept has mastery of at least 60. An anonymous request is `401`. An unverified email is `403 EMAIL_UNVERIFIED`. An unpublished interview, an ineligible student, and another student's session are `404`. The list omits interviews the student cannot open.

| Method | Path                              | Purpose                                              |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/interviews`                     | Published interviews the student is eligible for     |
| GET    | `/interviews/:slug`               | Overview and that student's history                  |
| POST   | `/interviews/:slug/sessions`      | `{}` starts a session on the first authored question |
| GET    | `/interview-sessions/:id`         | Current question, interviewer note, and report       |
| POST   | `/interview-sessions/:id/answers` | `{ clientAnswerId, text, code? }`                    |
| POST   | `/interview-sessions/:id/abandon` | `{}` closes an open session                          |
| GET    | `/interview-sessions/:id/report`  | Server score and stored qualitative report           |

`text` is at most 6000 characters. `code` is at most 8000. Together they are at most 10000. `score`, `question`, `mastery`, and any other extra field are `400 VALIDATION`. A verbal question rejects code. A code question requires code. The same user, session, and `clientAnswerId` returns the stored result and does not call the model or the runner again.

The server selects the question. One authored follow-up is allowed per main question, and only after a partial or incorrect answer when the model recommends it. A completed or abandoned session rejects further answers with `409 INTERVIEW_CLOSED`. A second active session is `409 INTERVIEW_ACTIVE`. A new start is refused at two completed interviews that day or ten starts in seven days (`429 RATE_LIMITED`). A session allows 30 model calls.

The code question uses the existing runner. A runner failure stores nothing. The model task is `interview`. Its JSON is normalized and cannot set the score, the next question, mastery, or completion. If the model is unavailable, the response is `503 AI_UNAVAILABLE` and the session stays on the same question. The final score and `scoreSource: "server"` come from the session row, not from the report prose.

## Speaking

A verified student can start one lesson-mode or interview-mode speaking practice. An anonymous request is `401`. An unverified email is `403`. Another student's session is `404`. The practice is not a lesson and does not list unpublished questions.

| Method | Path                              | Purpose                                                                   |
| ------ | --------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/speaking`                       | Practice title, question count, and the active session id                 |
| POST   | `/speaking/sessions`              | `{ mode: "lesson" \| "interview" }` starts on the first authored question |
| GET    | `/speaking/sessions/:id`          | Current question and the latest feedback                                  |
| POST   | `/speaking/sessions/:id/attempts` | JSON `{ clientAttemptId, text }` or multipart audio                       |
| POST   | `/speaking/sessions/:id/abandon`  | `{}` closes an open practice                                              |

Text is at most 6000 characters. Audio is at most 8 MB, at most 60 seconds, and must be `audio/webm`, `audio/ogg`, `audio/wav`, `audio/mp4`, or `audio/mpeg`. The server checks the file bytes. A client duration, MIME type, or filename is not trusted. Empty audio, an unknown type, a traversal filename, and an arbitrary extension are `400`. The same user, session, and `clientAttemptId` returns the stored result and does not transcribe or call the model again.

The model task is `teach` for lesson mode and `interview` for interview mode. Its JSON cannot set a score, the next question, mastery, or completion. Transcription uses `AI_TRANSCRIPTION_PROVIDER`, `AI_TRANSCRIPTION_MODEL`, and `AI_TRANSCRIPTION_API_KEY`. If those are unset, audio returns `503 SPEECH_UNAVAILABLE` and the text fallback still works. A model failure after a transcript is stored returns `503 AI_UNAVAILABLE`; the same `clientAttemptId` retries the model without transcribing again.

Limits, enforced in PostgreSQL: 20 new attempts per 10 minutes, 30 attempts per student day, 20 successful transcriptions per day, and 20 successful speaking model calls per day. Failed provider calls do not write usage. A correct answer writes at most one `learning_events` row with `source = speaking` and evidence 40. A session writes at most four. Unclear transcripts and provider failures write none.

## Health

| Method | Path            | Purpose                                                                                         |
| ------ | --------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Same as liveness                                                                                |
| GET    | `/health/live`  | Process up. Does not check AI, speech, payment, email, or the runner                            |
| GET    | `/health/ready` | Postgres answers `SELECT 1`. 503 `DATABASE_UNAVAILABLE` otherwise. No connection string or host |

## Phase 2 endpoints

JavaScript function exercises run through the existing attempt route and `apps/runner`. `POST /exercises/:id/review` explains a stored attempt and does not grade it. The routes below are still not built. The current API does not accept files, stream output, or call a model to grade code.

| Method | Path                   | Purpose                                                                                            |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/exercises/:id`       | Later: prompt, starter, visible tests. No hidden tests, no solution                                |
| POST   | `/attempts`            | Create attempt from an exercise and starter files                                                  |
| PUT    | `/attempts/:id/files`  | Save editor buffer                                                                                 |
| POST   | `/attempts/:id/run`    | Execute visible tests. Synchronous. No model                                                       |
| POST   | `/attempts/:id/submit` | Visible and hidden tests, then optional review task                                                |
| POST   | `/attempts/:id/hint`   | Next authored hint, else one `hint` model call                                                     |
| POST   | `/attempts/:id/review` | `review_code` task                                                                                 |
| POST   | `/attempts/:id/ask`    | Teacher turn whose context includes the selection or the error, still through the teaching service |

Run response:

```json
{
  "status": "failed",
  "durationMs": 120,
  "stdout": "",
  "stderr": "TypeError: ...",
  "tests": [{ "name": "adds two numbers", "passed": false, "message": "expected 3, received 4" }]
}
```

Hidden test failures on submit return `{ "name": "hidden", "passed": false, "message": "A hidden test failed." }` without the assertion body.

## Later endpoints

The portfolio project is the project section above. Arbitrary file trees, task marketplaces, and AI-authored projects are not routes.

Phase 4: `/interviews`, `/interviews/:id/turns`, `GET /interviews/:id/score`. Voice is not a new resource. It is `POST /teaching/sessions/:id/voice-turns` that transcribes, then uses the same turn pipeline, and returns audio generated from `speech`.

## Billing

`GET /api/v1/billing/plans` is public. It returns the active price catalog: slug, plan code, display name, description, amount in minor units, currency, interval, and boolean features. It does not return provider price ids.

`GET /api/v1/billing/subscription` requires a verified session. The body is the effective plan, status, period end, `cancelAtPeriodEnd`, and the same boolean features. Provider customer ids, subscription ids, and webhook ids are not returned.

`POST /api/v1/billing/checkout` accepts only `{ priceSlug, clientCheckoutId }`. Amount, currency, provider price id, and entitlement fields are rejected. The server loads the price, refuses a second active purchase of the same plan, and schedules a downgrade at period end instead of charging. The same `clientCheckoutId` returns the stored checkout URL. A missing provider returns `503 PAYMENT_UNAVAILABLE` and does not mark the subscription active.

`POST /api/v1/billing/cancel` sets cancel-at-period-end. The paid plan remains until `currentPeriodEnd`. `POST /api/v1/billing/reactivate` clears that flag while the period is still open. `POST /api/v1/billing/portal` returns `503 PAYMENT_UNAVAILABLE` until a provider implements a portal.

`POST /api/v1/billing/webhook` has no session and no CSRF header. The API verifies `x-payment-signature` against the raw body before parsing. An invalid signature is `401 PAYMENT_SIGNATURE`. A processed provider event id is a no-op. An older `occurredAt` does not replace a newer subscription. Only a verified event changes `subscriptions` and `user_plans`.

Commercial quota and the short-window rate limit are separate. `429 RATE_LIMITED` is the burst limit. `429 QUOTA_EXCEEDED` is the plan allowance. `402 FEATURE_NOT_INCLUDED` is a disabled capability. Teacher, review, project, interview, and speaking usage still count only successful server work. A failed model call, a failed transcription, a validation error, and a duplicate client id do not consume the commercial allowance. With no paid subscription, the effective plan is Free. An expired subscription returns the student to Free and does not delete learning rows.

## Admin

`GET /api/v1/admin/overview`, `/admin/students`, `/admin/students/:userId`, `/admin/learning`, `/admin/ai`, `/admin/billing`, and `/admin/system` require a verified session whose `users.role` is `admin`. The role is read from the database on the request. A missing session is 401. A student, an unverified account, and a removed admin role are 404. There is no admin POST that changes mastery, scores, subscriptions, quotas, or AI usage.

`window` is `today`, `7d`, or `30d` (default `7d`). The boundary is the Asia/Baku calendar day and ends at the request time. Extra query keys, a range longer than 30 days, and a non-UUID student cursor are 400. Student search accepts `q` (max 80), `limit` (1–50), and a UUID `cursor`. Responses are DTOs. They do not include password hashes, session tokens, reset tokens, verification tokens, submission text, transcripts, audio, or provider secrets.

AI `costMicros` is the stored sum. It is not recomputed from a price list. Speech cost is stored the same way and is labeled unverified against a provider tariff. Billing revenue is null unless `PAYMENT_*` is configured, and even then it is the catalog price of currently granting subscriptions (`estimated_catalog`), not captured cash. AI call failures, speech failures, runner failures, and database failures are not stored as failure rows; those categories return `recorded: false`.

## Idempotency and ordering

- Register is not idempotent. Duplicate email is 409.
- Teaching turns are idempotent via `clientTurnId`.
- Exercise attempts are idempotent via `clientAttemptId` for the same user and exercise.
- Project attempts are idempotent via `clientAttemptId` for the same user and milestone.
- Run and submit in Phase 2 accept `Idempotency-Key`. A repeat returns the stored attempt result and does not execute twice.
- Billing webhooks are idempotent on the provider event id.

## Pagination and consistency

Dashboard numbers come from the same tables as `/me/skills`. There is no separate analytics store in Phase 1, so the dashboard and the skill list cannot disagree.

Lesson completion is written when the teaching session enters `completed`, in the same transaction as the final homework row and the lesson_progress update.
