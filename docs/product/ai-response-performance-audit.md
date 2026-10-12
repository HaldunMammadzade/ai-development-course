# AI response speed and reliability audit

Date: 10 October 2026.

This is a baseline audit of the existing teacher path. No model, prompt, timeout, retry, cache, or streaming behavior was changed. No application code was changed.

Labels used below:

- **Verified issue:** supported by code, an existing test, or a measurement from this step.
- **Potential issue:** plausible, and not measured on a real teaching turn.
- **Unknown:** not enough evidence.

## 1. Executive summary

The teacher waits for one complete JSON completion. The page does not receive tokens as they are generated. A loading status is not streaming.

The provider call has a 20 second timeout, one attempt, and no automatic retry. Provider latency and token counts are stored after a successful turn. Total HTTP duration is logged separately. Prompt assembly and database time are not timed. The client has no request timeout and no recorded wait time.

A three-call probe of the configured adapter succeeded. Those times are not lesson latency. The prompt was 26 input tokens and the output cap was 32 tokens. A teaching turn uses the lesson packet and an output cap of 800 tokens. No percentile from this sample is a production figure.

Fake-provider tests passed from the turbo cache. They do not measure a live model.

## 2. Actual architecture and request lifecycle

Verified from the current source. Session open does not call the model. The model runs on a turn.

1. The student presses advance or sends an answer. `LessonExperience.send` in `apps/web/components/teaching/lesson-experience.tsx` refuses a second call while `pending` or `sending.current` is set. It posts `{ clientTurnId, advance: true }` or `{ clientTurnId, message }` through `apiPost`.
2. `apiRequest` in `apps/web/lib/api/client.ts` sends JSON with `x-requested-with: fetch` and credentials. It has no timeout and no abort signal. A network failure becomes `NetworkError`.
3. `TeachingController.turn` in `apps/api/src/modules/teaching/teaching.controller.ts` requires `SessionAuthGuard` and `VerifiedEmailGuard`, validates the body with `teachingTurnSchema`, and passes a correlation id.
4. `TeachingOrchestrator.turn` calls `TeachingRepository.prepareTurn`. A repeated `clientTurnId` returns the stored result. A turn already in progress is polled for up to 25 seconds (`WAIT_MS`), then `409 TURN_IN_PROGRESS`. Quota and the 20-turn burst are checked here, before the model.
5. `TeachingOrchestrator.invoke` loads the current block, calls `buildTeacherContext`, then `renderTeachPrompt`. `assertInputSize` rejects a system-plus-user string over the configured character cap.
6. `completeTeach` in `packages/ai/src/router/model-router.ts` resolves the teach route and calls `AIProvider.complete`. The API wires `OpenAiCompatibleProvider` or `DisabledAiProvider` in `apps/api/src/modules/ai/ai.module.ts`.
7. `OpenAiCompatibleProvider.complete` posts once to `{baseUrl}/chat/completions` with `response_format: json_object`. It reads the full body, parses the envelope, then parses the message content as JSON. There is no `stream` field.
8. `normalizeTeacherOutput` checks the teacher schema and the lesson rules. `recordAiUsage` builds the usage row. `commitTurn` writes the speech, learning updates, and `ai_usage` in one transaction.
9. The controller returns that JSON body. `configureApp` logs the HTTP status and `durationMs` on `finish`, with the correlation id.
10. `send` replaces the session, which re-renders `LessonWorkspace` and `TeacherPanel`. The status returns from “AI müəllim düşünür...” to the lesson state. The previous teacher text stays in the panel until that replacement.

`packages/curriculum/src/teaching-stream.ts` can wrap a finished turn as `teacher.started` then `teacher.completed`. Nothing in `apps/api` or `apps/web` calls it. The HTTP response is one JSON document.

Code review, project review, interview, and speaking use the same `complete` method and the same 20 second timeout. Their prompts were not timed.

## 3. Verified timing instrumentation

All durations below use `Date.now()`, which follows the wall clock. None use `performance.now()` or `process.hrtime`. A clock step can distort a sample. They exist in every environment that runs the API. They are log lines or database rows, not a metrics store.

| Measurement          | Where                                                       | What it covers                                        | Correlation                                                                     |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| HTTP `durationMs`    | `apps/api/src/configure-app.ts` via `httpLog`               | Auth, database, provider, commit, and response finish | `x-correlation-id`. No body.                                                    |
| Provider `latencyMs` | `OpenAiCompatibleProvider.complete`, stored by `commitTurn` | Fetch, full-body read, and JSON parse                 | Teach log and `ai_usage.correlationId`. Written only after a successful commit. |
| Teach log            | `TeachingOrchestrator.log`                                  | Outcome, provider, model, `latencyMs`, token counts   | Correlation id, user id, session id. No prompt and no speech.                   |

Not recorded:

- Time to assemble context or the prompt.
- Database time before or after the provider call.
- Time to first token. Streaming is not implemented, so this value does not exist.
- Client waiting time.
- A failed provider call’s latency. `failTurn` stores the error code and does not write `ai_usage`.

The smallest later instrumentation is four monotonic spans on the existing correlation id: prepare, prompt, provider, commit. Keep them in the current log line. Do not log prompts, speech, or the API key. Add a client mark from the click to the rendered speech, with no message text. Collect those on a small set of real advance turns before changing the model or adding streaming.

## 4. Measurement results and sample sizes

### Live adapter probe

The local AI configuration is present. `AI_PROVIDER` is `openai-compatible`. `AI_TEACH_MODEL` is `gpt-4o-mini`. `AI_REVIEW_MODEL` and `AI_BASE_URL` are unset, so review uses the teach model and the base URL falls back to `https://api.openai.com/v1`. `AI_MAX_INPUT_CHARS` and `AI_MAX_OUTPUT_TOKENS` are unset, so the application defaults are 12,000 characters and 800 output tokens. The API key was used and was not printed.

Three sequential calls went through `OpenAiCompatibleProvider.complete` only. They did not open a session, write learning state, or render the UI. The probe system text asked for `{"ok":true}`. The user text was `ping`. Temperature was 0.2 and the timeout was 20,000 ms, matching the teach route. `maxOutputTokens` was 32 for this probe so the call would stay small. Production turns are allowed 800.

| Attempt | Result  | Provider `latencyMs` | Input tokens | Output tokens |
| ------- | ------- | -------------------- | ------------ | ------------- |
| 1       | success | 1815                 | 26           | 5             |
| 2       | success | 1099                 | 26           | 5             |
| 3       | success | 1230                 | 26           | 5             |

Attempted 3, succeeded 3, timed out 0, failed 0. The model id on every response was `gpt-4o-mini`. Wall time around the call matched `latencyMs` on these three. The calls shared one process. Whether the provider treated the first as cold is unknown. p50 and p95 are not reported. Three calls cannot describe production.

This is a lower bound on a tiny completion. It is not the wait a student sees on a lesson.

### Not measured

- A real teaching turn’s HTTP time, provider time, prompt size, or token counts.
- Prompt-assembly time and database time.
- Perceived UI time.
- Error rate, rate limits, or timeouts against the live provider. The probe had none, and the sample is three successes.
- Concurrent load. None was run.

### Later procedure

1. Keep the probe prompt and the 32-token cap out of the comparison.
2. On a local API with the same configuration, sign in as a disposable verified student and advance the first lesson once. Repeat a fixed short answer a few times, sequentially.
3. Read `durationMs` from the HTTP log and `latencyMs` plus token counts from `ai_usage`, joined by correlation id.
4. Subtract provider latency from HTTP duration to see the application remainder. That remainder still mixes database, prompt work, and normalization until the spans in section 3 exist.
5. Do not print the prompt, the speech, or the key. Do not run concurrent requests.

## 5. Reliability and failure-handling matrix

| Case                                  | Behavior                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Provider timeout                      | `AbortSignal.timeout(timeoutMs)` with `timeoutMs` 20,000. `TimeoutError` or `AbortError` becomes `AIProviderError` `timeout`. The turn is failed and the client receives 503 `AI_UNAVAILABLE`.                                                                                                                              | Code. Fake HTTP test sets `teacher.failure = "timeout"` and expects 503. Not run against the live provider.                                |
| Rate limit                            | HTTP 429 from the provider becomes `rate_limit`, then the same 503 message. No backoff and no second attempt.                                                                                                                                                                                                               | Code in `providerErrorCode`. No live 429 in this audit.                                                                                    |
| Provider 5xx                          | `unavailable`, then 503.                                                                                                                                                                                                                                                                                                    | Code. Fake test `failure = "unavailable"` expects 503 and zero usage rows.                                                                 |
| Network error from the provider       | Any other fetch throw becomes `unavailable`, then 503.                                                                                                                                                                                                                                                                      | Code. Not separated from a timeout in a live test.                                                                                         |
| Empty or invalid provider body        | `invalid_response` or `malformed_json`, then 503.                                                                                                                                                                                                                                                                           | Code and fake tests for malformed and invalid output.                                                                                      |
| Safety refusal                        | Body text containing `content_filter`, `safety`, or `refusal` on a non-success status becomes `safety_refusal`, then 503.                                                                                                                                                                                                   | Code. Not exercised live.                                                                                                                  |
| Adapter or teacher validation failure | Normalization throws `AIProviderError` `invalid_response` for leaked or illegal output. Same 503 path.                                                                                                                                                                                                                      | Code in `normalizeTeacherOutput`. Fake teaching tests cover rejected model output.                                                         |
| Client cancel or navigation           | `apiRequest` has no abort signal. Leaving the page does not cancel the provider call. The server can still commit the turn.                                                                                                                                                                                                 | Code. Not observed in a browser this step.                                                                                                 |
| Duplicate submit                      | The client ref blocks a second post while the first is in flight. The server claim lets one provider call proceed. A second request with the same id waits up to 25 seconds and then receives the same body. A failed id replays the 503 and does not call the model again.                                                 | Web test “does not send a second turn while the first is in flight”. Teaching HTTP tests for a concurrent pair and for a replayed failure. |
| Retry                                 | The provider is not retried. A user retry after `AI_UNAVAILABLE` clears `clientTurnId`, so the next press is a new turn and a new provider call. A `NetworkError` keeps the id, so the next press replays. Email job retries do not apply to teaching.                                                                      | Code in `LessonExperience.send`. Fake test: a replayed failure does not increment `teacher.calls`.                                         |
| User-visible error                    | Turn failure shows `copy.errors.ai`: “AI müəllim hazırda cavab verə bilmir. Bir az sonra yenidən cəhd edin.” Session-open failure sets `role="alert"` and “Yenidən cəhd et”. A turn failure leaves the phase ready, so recovery is the same advance or send button. The composer keeps the draft when `send` returns false. | Code. Web test covers a failed session open, not a failed turn click.                                                                      |

The provider call itself cannot wait past 20 seconds. The HTTP request can wait longer: the duplicate poll is 25 seconds, and the database work after a successful completion has no timeout. The browser fetch has no timeout, so a stuck connection waits until the browser or a proxy closes it.

A failed turn does not write usage or consume the teacher quota. The free plan seed is 40 turns a day and 600 a month. A burst of 20 successful turns in 10 minutes is rejected before the model. Those limits are verified in source and in the fake HTTP tests. They were not observed on a live account in this step.

## 6. Prompt, model, and token-cost findings

Selection is configuration, not a hardcoded model name. `loadAiEnv` requires `AI_PROVIDER`, `AI_TEACH_MODEL`, and `AI_API_KEY` together. This machine is set as in section 4. `AiModule` passes that teach model to `createModelRouter` and uses the same model for review, project review, and interview when `AI_REVIEW_MODEL` is empty. Strength defaults to `fast` because the module does not set it.

`ModelRouter.resolve("teach")` fixes temperature at 0.2, timeout at 20,000 ms, and the cost constants at 150,000 input micros and 600,000 output micros per million tokens. Those constants are not read from the provider. Whether they match an invoice is unknown.

`renderTeachPrompt` builds a system string from `TEACHER_SYSTEM_PROMPT` (`teacher.system.v3`, 3,284 characters) and a user string from the mode, the server strategy, the state line, and a JSON lesson packet. The student message is appended as untrusted text. The full prompt text is not copied here.

Bounds that are in the prompt:

- Last 6 messages, each cut at 1,000 characters. The query also takes 6.
- Student message cut at 2,000 characters. The composer uses the same cap.
- Summary cut at 800 characters.
- At most 3 misconceptions, descriptions cut at 280 characters. The query loads 10.
- At most 3 memory notes, each cut at 280 characters, after a query of 30.
- One assigned homework prompt, cut at 280 characters. The query does not set `take`.
- System plus user must be at or under 12,000 characters or the turn is rejected before the provider call.

The prompt does not grow with the whole session. The message table does. That storage growth was not measured.

Token counts come from the provider `usage` object. Missing or negative counts are stored as 0. A successful teach turn writes `inputTokens`, `outputTokens`, `costMicros`, and `latencyMs` on `ai_usage`. The client response only says `usage.turnConsumed`. The probe recorded 26 and 5. A lesson packet’s token count is unknown.

`admitExplanationCache` can accept a generic explanation. `TeachingOrchestrator` does not read or write `explanation_cache`. The teaching HTTP test expects the cache count to stay unchanged. `AiRepository.findExplanation` is not called from `apps/api`. Every accepted teach turn calls the provider. Cached speech would skip personalization, so turning the cache on is a product decision, not a free speedup.

## 7. Frontend perceived-speed findings

Verified from source and the existing web tests. The lesson UI was not opened for this audit, and no wait was timed in the browser.

- The status becomes “AI müəllim düşünür...” when the session phase is `loading` or a turn is `pending`. The advance label becomes “Gözləyin...”. The composer send button does the same and the field is disabled.
- The status ends when `apiPost` resolves and `pending` is cleared. There is no partial speech.
- A second click while the first request is in flight does not post again. Covered by the lesson experience test.
- Existing teacher messages stay mounted. The panel still maps `messages` while the status says the teacher is thinking.
- A failed turn shows the alert text and keeps the composer draft. The student retries with the same button. A failed session open has “Yenidən cəhd et”.
- The thinking line is `role="status"` and `aria-live="polite"`. The error is `role="alert"`.
- Incremental output is not supported.

**Verified issue:** the student sees a single waiting state for the whole round trip, including database work and a provider call that may last up to 20 seconds. Nothing in the interface shows progress inside that wait.

**Potential issue:** a long wait and a failure look similar until the alert replaces the status. There is no elapsed time and no cancel.

**Unknown:** how long students actually wait, and whether the status is announced clearly by a screen reader during a real turn.

## 8. Test evidence and environment limitations

Command: `EXECUTION_MODE=fake pnpm test --concurrency=1`, with the local environment loaded.

Exit code 0. Tasks: 20 successful, 20 total. Cached: 20 cached, 20 total. Time reported by turbo: 163 ms, full cache. These are replays of earlier runs, not new executions. Nest `ERROR` lines in the API replay are the exception-filter tests.

| Package    | Tests      |
| ---------- | ---------- |
| config     | 23 passed  |
| execution  | 7 passed   |
| validation | 29 passed  |
| runner     | 15 passed  |
| curriculum | 141 passed |
| database   | 11 passed  |
| ai         | 80 passed  |
| web        | 75 passed  |
| api        | 111 passed |

Total 492 passed, 0 skipped, 0 failed. The AI and teaching HTTP tests use the fake provider. Their timings are not live latency.

Lint, typecheck, and the production build were not run. This step changed documentation only.

The live probe in section 4 is the only real-provider sample. The browser was not used.

## 9. Ranked bottlenecks

1. **Verified issue.** The student waits for the entire completion. `OpenAiCompatibleProvider.complete` reads the full body, and `LessonExperience` renders only after `apiPost` returns. Evidence: provider source, lesson experience, and the unused `completedTeachingEvents` helper. User impact is high. Confidence is high. Changing this means streaming, which is a large behavior change and is not justified until a real turn is timed.
2. **Verified, updated in section 11.** Four real first-lesson turns were timed after the spans shipped. Provider time was 1,209–2,761 ms and was almost all of the server total. The section 4 probe remains a different, smaller request.
3. **Verified, updated in section 11.** A teaching turn now logs `prepare_ms`, `prompt_ms`, `provider_ms`, `commit_ms`, and `total_ms` on one monotonic clock, with the existing correlation id. HTTP `durationMs` is still a separate `Date.now()` log. Stored `ai_usage.latencyMs` is still the provider’s own wall-clock value.
4. **Verified issue.** The explanation cache is not on the teach path, so every successful turn pays for a provider call. Evidence: orchestrator, teaching HTTP cache-count assertion, and `AiRepository` unused by the API. The speed effect is unknown. Using the cache would also change which speech a student sees.
5. **Verified on this sample.** `prepare_ms` was 22–37 ms and `commit_ms` was 36–42 ms. Together they are a small fraction of the wait. The homework query without `take` was not isolated inside `prepare_ms`.
6. **Verified issue, lower urgency.** The browser request has no timeout. The provider call does. A stalled connection after the provider returns, or instead of a clean timeout, has no client deadline.

## 10. Recommended next implementation step

The span measurement in section 11 and the model comparison in section 12 are done. The recommendation after those measurements is at the end of section 12.

## 11. Instrumentation and first-lesson baseline, 10 October 2026

### Span definitions

`TeachingOrchestrator.turn` records one `teach_timing` log per teaching turn. The clock is `performance.now()`, injected as `TEACHING_MONOTONIC`. A missing span is `null`. A measured empty span is `0`. Component spans do not overlap.

- `prepare_ms` is `TeachingRepository.prepareTurn` only. It excludes prompt construction. It includes quota, burst, and the lesson snapshot query.
- `prompt_ms` is `buildTeacherContext`, `renderTeachPrompt`, the teach-route lookup used to check input size, and `assertInputSize`.
- `provider_ms` is `completeTeach` only. That function resolves the route again and then calls `AIProvider.complete`. It does not include normalization or `commitTurn`.
- `commit_ms` starts after the provider returns. On success it includes `normalizeTeacherOutput`, `recordAiUsage`, and `commitTurn`. On a provider or normalization failure it includes `failTurn`. A path that never reaches post-processing leaves `commit_ms` null.
- `total_ms` is the whole `turn()` call. It is larger than the sum of the four spans by the strong-model route lookup that happens before `prepare`, plus the boundaries between spans. HTTP `durationMs` is outside this method and still uses `Date.now()`.

`replay` and a pending wait that returns a stored turn set `outcome` to `replay` and leave `prompt_ms`, `provider_ms`, and `commit_ms` null. A provider timeout keeps the HTTP 503 `AI_UNAVAILABLE` response and sets the log outcome to `timeout`. There is no cancellation outcome. The provider is still one attempt, with the same 20 second timeout. The event does not include the prompt, the student answer, the speech, or credentials.

A redacted success event:

```json
{
  "event": "teach_timing",
  "correlationId": "lesson-turn-1",
  "outcome": "success",
  "error": null,
  "provider": "openai-compatible",
  "model": "gpt-4o-mini",
  "prepare_ms": 37.3,
  "prompt_ms": 0.6,
  "provider_ms": 2760.8,
  "commit_ms": 41.3,
  "total_ms": 2840.4
}
```

### Files

- `apps/api/src/modules/teaching/teach-timing.ts`
- `apps/api/src/modules/teaching/teach-timing.spec.ts`
- `apps/api/src/modules/teaching/teaching.orchestrator.ts`
- `apps/api/src/modules/teaching/teaching.tokens.ts`
- `apps/api/src/modules/teaching/teaching.module.ts`
- `apps/api/src/modules/teaching/teaching.http.spec.ts`
- `docs/product/ai-response-performance-audit.md`

No dependency and no migration. Stored `ai_usage.latencyMs` is unchanged when the provider reports a positive latency.

### Tests

`EXECUTION_MODE=fake pnpm test --concurrency=1` exited 0. Tasks: 20 successful, 20 total. Cached: 18 cached, 20 total. Fresh: `@platform/api` build and `@platform/api` test. API tests: 29 files, 114 passed, 0 skipped. The other packages replayed cached logs: config 23, execution 7, validation 29, runner 15, curriculum 141, database 11, ai 80, web 75. Reported total: 495 passed, 0 skipped, 0 failed. The new API tests use the fake provider and a manual clock. They are not live latency.

`pnpm lint`: 11/11, exit 0. API lint executed; the other 10 were cache hits. `pnpm typecheck`: 22/22, exit 0. API typecheck executed; the other 21 were cache hits. `NODE_ENV=production pnpm build`: 11/11, exit 0, full cache. It replays the API compile `2b8a9630b527eb05` from the fresh test run, and the previous web compile `55a98feec9163e92`.

The browser was not opened. Perceived wait and time to first token were not measured. There is still no token stream.

### Real lesson turns

Local API, not production. Provider `openai-compatible`, model `gpt-4o-mini`, output cap 800, timeout 20 seconds. A new verified student opened `how-the-web-delivers-a-page`. Four sequential turns, no concurrency, no retries, no timeouts. The answer text was the fixed string used when the state required an answer. Values are milliseconds from `performance.now()`, shown to one decimal. HTTP `durationMs` is the separate wall-clock log.

| Request       | Kind              | HTTP | Outcome | prepare | prompt | provider | commit | total  | HTTP |
| ------------- | ----------------- | ---- | ------- | ------- | ------ | -------- | ------ | ------ | ---- |
| lesson-turn-1 | first advance     | 200  | success | 37.3    | 0.6    | 2760.8   | 41.3   | 2840.4 | 2845 |
| lesson-turn-2 | follow-up answer  | 200  | success | 26.1    | 0.1    | 1209.0   | 41.8   | 1277.0 | 1284 |
| lesson-turn-3 | follow-up advance | 200  | success | 24.6    | 0.2    | 1948.8   | 42.3   | 2016.1 | 2021 |
| lesson-turn-4 | follow-up advance | 200  | success | 22.5    | 0.2    | 1666.8   | 36.2   | 1725.7 | 1731 |

States moved `created` to `prior_check`, `objective`, `explain`, then `comprehension_check`. The lesson was not completed. Each correlation id has one timing event. The span sums sit 0.03–0.44 ms under `total_ms`. HTTP duration is 5–7 ms above `total_ms` because it includes middleware outside `turn()`.

These are not the section 4 probe. That probe was three direct adapter calls with 26 input tokens and a 32-token cap (1,815 ms, 1,099 ms, 1,230 ms). These four rows are full teaching turns. Four rows are not a percentile and not a production sample.

### Next step from this evidence

Prompt assembly and persistence are not the wait. The provider call is. Section 12 compares other models on a matched lesson script. A time-to-first-token probe was not run.

## 12. Model benchmark, 10 October 2026

This step did not change the saved model, prompts, output contract, timeouts, retries, caching, or streaming. `.env` still sets `AI_TEACH_MODEL=gpt-4o-mini`. The two alternative lesson runs used that variable only on a local API process, then the process was stopped. No application code changed.

### Candidates

The account’s model list includes many chat ids. The existing adapter posts `temperature`, `max_tokens`, and `response_format: json_object` to `/chat/completions`. Two alternatives accepted that body. A third was rejected.

One compatibility call per id used the same temperature (0.2), timeout (20 seconds), and JSON object format as teaching. The user text was `ping` and the output cap on that call was 800. These three calls are not lesson turns. They are the same class of request as the section 4 probe.

| Model        | HTTP | Result                                  | Elapsed  | Input tokens | Output tokens |
| ------------ | ---- | --------------------------------------- | -------- | ------------ | ------------- |
| gpt-4.1-nano | 200  | success                                 | 958.4 ms | 26           | 5             |
| gpt-4.1-mini | 200  | success                                 | 984.8 ms | 26           | 5             |
| gpt-5-nano   | 400  | `unsupported_parameter` on `max_tokens` | 324 ms   | none         | none          |

`gpt-5-nano` cannot be called without changing the adapter. It was not used for a lesson. The lesson sample is the current model plus `gpt-4.1-nano` and `gpt-4.1-mini`. Returned snapshot ids on the two successes were `gpt-4.1-nano-2025-04-14` and `gpt-4.1-mini-2025-04-14`. The configured id sent to the API was the unsuffixed name.

### Lesson method

Local API, not production. One new verified student per model. Each student opened `how-the-web-delivers-a-page` through `POST /api/v1/teaching/sessions`. Five sequential turns, one at a time, no retries and no concurrent requests. The same script for every model:

1. Advance from `created`.
2. A fixed partial answer: the browser opens the address and shows the page, with no mention of the HTTP request or response.
3. Advance.
4. Advance.
5. A fixed misconception: the browser creates the HTML itself and does not send a request.

An earlier five-call attempt on `gpt-4o-mini` returned HTTP 400 because `clientTurnId` was not a UUID. Those calls failed schema validation in 3–6 ms and did not call the model. They are not in the table.

Timing is the section 11 `teach_timing` event. HTTP `durationMs` is the separate wall-clock log. Token counts are from `ai_usage` for accepted turns. A rejected turn writes no usage row. The lesson has no code example, and a new student cannot open a later code lesson without completing this one, so a code-explanation task was not run.

Values below are milliseconds, to one decimal. Provider `latencyMs` in `ai_usage` matches the rounded provider wall clock and is omitted from the table.

| Request        | Model        | Kind           | HTTP | Outcome                  | prepare | prompt | provider | commit | total  | HTTP | In   | Out |
| -------------- | ------------ | -------------- | ---- | ------------------------ | ------- | ------ | -------- | ------ | ------ | ---- | ---- | --- |
| bench-4omini-1 | gpt-4o-mini  | first advance  | 200  | success                  | 87.6    | 0.7    | 1737.2   | 57.0   | 1883.1 | 1890 | 1219 | 133 |
| bench-4omini-2 | gpt-4o-mini  | partial answer | 200  | success                  | 27.5    | 0.1    | 1387.4   | 41.0   | 1456.1 | 1462 | 1185 | 100 |
| bench-4omini-3 | gpt-4o-mini  | advance        | 200  | success                  | 22.8    | 0.2    | 1751.9   | 39.6   | 1814.7 | 1821 | 1242 | 128 |
| bench-4omini-4 | gpt-4o-mini  | advance        | 200  | success                  | 25.8    | 0.1    | 1562.7   | 41.0   | 1629.7 | 1636 | 1240 | 125 |
| bench-4omini-5 | gpt-4o-mini  | misconception  | 503  | error `invalid_response` | 23.5    | 0.2    | 1872.5   | 11.7   | 1908.1 | 1917 | —    | —   |
| bench-41nano-1 | gpt-4.1-nano | first advance  | 200  | success                  | 39.1    | 0.6    | 1224.1   | 73.8   | 1338.0 | 1344 | 1219 | 135 |
| bench-41nano-2 | gpt-4.1-nano | partial answer | 200  | success                  | 22.4    | 0.1    | 896.2    | 151.1  | 1069.9 | 1084 | 1185 | 74  |
| bench-41nano-3 | gpt-4.1-nano | advance        | 200  | success                  | 27.8    | 0.2    | 1033.2   | 57.6   | 1119.0 | 1146 | 1242 | 95  |
| bench-41nano-4 | gpt-4.1-nano | advance        | 200  | success                  | 58.9    | 0.4    | 1017.1   | 24.2   | 1100.7 | 1113 | 1240 | 102 |
| bench-41nano-5 | gpt-4.1-nano | misconception  | 503  | error `invalid_response` | 14.7    | 0.1    | 1956.0   | 13.3   | 1984.1 | 1995 | —    | —   |
| bench-41mini-1 | gpt-4.1-mini | first advance  | 200  | success                  | 35.3    | 0.5    | 1356.2   | 44.0   | 1436.4 | 1441 | 1219 | 146 |
| bench-41mini-2 | gpt-4.1-mini | partial answer | 200  | success                  | 26.8    | 0.1    | 1175.1   | 36.1   | 1238.1 | 1245 | 1185 | 120 |
| bench-41mini-3 | gpt-4.1-mini | advance        | 200  | success                  | 22.8    | 0.2    | 1324.6   | 54.3   | 1402.0 | 1409 | 1242 | 134 |
| bench-41mini-4 | gpt-4.1-mini | advance        | 200  | success                  | 31.3    | 0.1    | 1456.7   | 47.9   | 1536.1 | 1540 | 1240 | 153 |
| bench-41mini-5 | gpt-4.1-mini | misconception  | 200  | success                  | 22.3    | 0.2    | 2426.0   | 65.8   | 2514.3 | 2523 | 1217 | 320 |

Attempted 15 lesson turns. Succeeded 13. Failed 2, both `invalid_response` after the provider returned, both HTTP 503 `AI_UNAVAILABLE`. Timed out 0. Retries 0. Each correlation id has one `teach_timing` event. The lesson was not completed. States on the successful path were `prior_check`, `objective`, `explain`, `comprehension_check`, and, for `gpt-4.1-mini` only, `adapt`.

These rows are not the section 11 baseline. That baseline used a different answer (“Bilmirəm.”) and stopped at `comprehension_check`. They are also not the ping probes above. Five turns per model are not a percentile.

Span sums sit 0.03–0.70 ms under `total_ms`, for the same reason as section 11: the strong-model route lookup happens before `prepare`. HTTP `durationMs` is 6–27 ms above `total_ms`. The first turn of each process has a higher `prepare_ms` (35–88 ms) than the later turns. Whether the provider treated the first call as cold is unknown. Provider time is still almost all of `total_ms` on every success.

### Quality

Automated checks are the HTTP status, the teaching state, the understanding value, speech length, and whether normalization accepted the output. A 200 means the existing teacher schema accepted the speech. Human review is a reading of that accepted speech against the rubric below. No model self-rating was used. Speech is not copied here.

| Rubric                   | gpt-4o-mini                                                                                          | gpt-4.1-nano                                                                                                                                  | gpt-4.1-mini                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical correctness    | The four accepted turns describe the HTTP request, the response, and the browser showing HTML.       | The accepted turns describe the request. The explain and check turns stop at the request and do not state the response or the rendering step. | Accepted turns describe the request, the response, and rendering. The misconception turn says the browser does not create the HTML.                            |
| Beginner explanation     | Short Azerbaijani sentences. The same three steps are repeated on every accepted turn.               | Short sentences. The explanation is thinner than the lesson’s three steps.                                                                    | Short sentences and a complete three-step account.                                                                                                             |
| Relevance to the student | The partial-answer turn does not mention what the student got right. Understanding stayed `unknown`. | The partial-answer turn asks what happens first and does not name the missing request. Understanding stayed `unknown`.                        | The partial-answer turn agrees that the browser opens the address and shows the page, then adds the missing request and response. Understanding was `partial`. |
| Hinting and scaffolding  | Each accepted turn restates the full path and asks a question.                                       | The partial-answer turn is a short question. Later turns still explain only the request.                                                      | The partial-answer turn builds on the student’s words. The misconception turn corrects the false claim and asks whether the browser sends an HTTP request.     |
| Output contract          | 4 of 5 accepted. The misconception turn was `invalid_response`.                                      | 4 of 5 accepted. The misconception turn was `invalid_response`.                                                                               | 5 of 5 accepted. Understanding on the misconception turn was `incorrect`, and the server moved to `adapt`.                                                     |
| Unsupported claims       | None seen in the accepted speech.                                                                    | None seen in the accepted speech.                                                                                                             | None seen in the accepted speech.                                                                                                                              |
| Premature full answer    | The opening turn already lists sorğu, cavab, and göstərmə.                                           | The opening turn explains the request and names HTTP. It does not list all three steps.                                                       | The opening turn lists the three steps. The misconception turn then gives the corrected mechanism, which matches the server’s `adapt` state.                   |

The rejected bodies were not logged, so the two `invalid_response` failures have no speech to score. A code example was not part of this lesson.

### Cost

List prices below are the standard text rates published by OpenAI for these model ids: `gpt-4o-mini` $0.15 / $0.60 per million input and output tokens, `gpt-4.1-nano` $0.10 / $0.40, and `gpt-4.1-mini` $0.40 / $1.60. Source: the OpenAI pricing page and the model pages for those three ids, read on 10 October 2026. The usage rows do not split cached input, so the estimate uses the uncached input rate. It is not an invoice. The application’s stored `costMicros` still uses the teach-route constants of $0.15 and $0.60 per million for every model, so that stored figure is not the list price of `gpt-4.1-mini` or `gpt-4.1-nano`.

Accepted turns only:

| Model        | Accepted turns | Input tokens | Output tokens | List-price estimate |
| ------------ | -------------- | ------------ | ------------- | ------------------- |
| gpt-4o-mini  | 4              | 4,886        | 486           | $0.00102            |
| gpt-4.1-nano | 4              | 4,886        | 406           | $0.00065            |
| gpt-4.1-mini | 5              | 6,103        | 873           | $0.00384            |

The first four turns are the matched subset, because turn 5 was accepted only for `gpt-4.1-mini`. On those four turns `gpt-4.1-mini` used 4,886 input and 553 output tokens, about $0.00284, roughly 2.8 times the current model’s four-turn estimate. `gpt-4.1-nano` was cheaper on the same four turns.

### Tests

No application code changed. `EXECUTION_MODE=fake pnpm test --concurrency=1` exited 0. Tasks: 20 successful, 20 total. Cached: 20 cached, 20 total. Turbo reported full cache and 199 ms. This is a replay of the section 11 run, including the API log that started at 13:06:09 and recorded 114 API tests. It is not a new execution. The replay’s package counts are config 23, execution 7, validation 29, runner 15, curriculum 141, database 11, ai 80, web 75, and api 114. Total 495 passed, 0 skipped, 0 failed. Lint, typecheck, and the production build were not run again. The browser was not opened.

### Recommendation

Keep `gpt-4o-mini`.

On turns 1–4, `gpt-4.1-nano` provider time was 896–1,224 ms and `gpt-4.1-mini` was 1,175–1,457 ms, against 1,387–1,752 ms for `gpt-4o-mini` on the same inputs. That is a speed difference on this sample. It is five sequential calls in one session per model, taken within a few minutes, with no separated cold-start proof. `gpt-4.1-nano` left out the response and rendering steps and failed the misconception turn. `gpt-4.1-mini` handled the partial answer and the misconception, and its misconception call was the slowest provider time in the sample at 2,426 ms. Its list price is also higher. Neither result is enough to change the production model.

Section 12 recommended one more matched sample of these two models. That sample is section 13. A streaming probe was not part of either measurement.

## 13. Matched retest, 10 October 2026

Same lesson script as section 12, for `gpt-4o-mini` and `gpt-4.1-mini` only. One new verified student per model, local API, sequential turns, valid UUID `clientTurnId` values. The saved file still has `AI_TEACH_MODEL=gpt-4o-mini`. `gpt-4.1-mini` was a process environment override and was not written to `.env`. No application code changed. The section 12 rows stay the first sample. The rows below are the second sample.

No request failed before the provider. Each of the ten turns has one `teach_timing` event with a positive `provider_ms`. Retries 0. Timeouts 0. The test API was stopped after the tenth turn. That shutdown is not a model failure.

| Request         | Model        | Kind           | Reached provider | HTTP | Schema   | State               | Understanding | provider | total  | HTTP | In   | Out |
| --------------- | ------------ | -------------- | ---------------- | ---- | -------- | ------------------- | ------------- | -------- | ------ | ---- | ---- | --- |
| retest-4omini-1 | gpt-4o-mini  | first advance  | yes              | 200  | accepted | prior_check         | unknown       | 1938.9   | 2322.0 | 2334 | 1220 | 127 |
| retest-4omini-2 | gpt-4o-mini  | partial answer | yes              | 200  | accepted | objective           | unknown       | 1247.5   | 1348.7 | 1360 | 1186 | 112 |
| retest-4omini-3 | gpt-4o-mini  | advance        | yes              | 200  | accepted | explain             | unknown       | 1840.5   | 1929.4 | 1935 | 1243 | 133 |
| retest-4omini-4 | gpt-4o-mini  | advance        | yes              | 200  | accepted | comprehension_check | unknown       | 1323.2   | 1386.9 | 1397 | 1241 | 124 |
| retest-4omini-5 | gpt-4o-mini  | misconception  | yes              | 200  | accepted | adapt               | incorrect     | 2006.9   | 2111.0 | 2200 | 1218 | 181 |
| retest-41mini-1 | gpt-4.1-mini | first advance  | yes              | 200  | accepted | prior_check         | unknown       | 1331.2   | 1411.6 | 1418 | 1220 | 117 |
| retest-41mini-2 | gpt-4.1-mini | partial answer | yes              | 200  | accepted | objective           | partial       | 1217.4   | 1282.1 | 1291 | 1186 | 114 |
| retest-41mini-3 | gpt-4.1-mini | advance        | yes              | 200  | accepted | explain             | correct       | 1864.5   | 2018.9 | 2027 | 1243 | 181 |
| retest-41mini-4 | gpt-4.1-mini | advance        | yes              | 200  | accepted | comprehension_check | unknown       | 1519.0   | 1621.9 | 1637 | 1241 | 142 |
| retest-41mini-5 | gpt-4.1-mini | misconception  | yes              | 200  | accepted | adapt               | incorrect     | 2291.1   | 2385.7 | 2395 | 1218 | 286 |

Durations are milliseconds from `teach_timing`, to one decimal. Tokens are from `ai_usage`. The adapter stores `prompt_tokens` and `completion_tokens` only, so a cached-input split is unavailable and the estimate uses the uncached published rate. Prepare was 20–46 ms except the first `gpt-4o-mini` turn at 297.4 ms. Prompt was under 1 ms. Provider time is still most of the total. Ten rows are not a percentile.

### Misconception turn across both samples

| Sample     | gpt-4o-mini                                                                                                                                                                                                                                               | gpt-4.1-mini                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 12 | Provider returned. Schema rejected the body (`invalid_response`, HTTP 503). No speech to review. Provider 1,872.5 ms.                                                                                                                                     | Schema accepted. Understanding `incorrect`, state `adapt`. The speech says the browser does not create the HTML, restates the request and response, and asks whether the browser sends an HTTP request. Provider 2,426.0 ms. |
| Section 13 | Schema accepted. Understanding `incorrect`, state `adapt`. The speech says the claim is wrong, the browser does not create the HTML, and the request and response happen first, then asks which steps come before the page is shown. Provider 2,006.9 ms. | Schema accepted. Understanding `incorrect`, state `adapt`. The speech calls the claim wrong, says the browser sends a request and receives HTML, then asks which step comes before the page is shown. Provider 2,291.1 ms.   |

Schema acceptance and teaching quality are separate. In section 13 both models passed the schema and both identified the misconception. Both also stated the corrected mechanism. That matches the server’s `adapt` state. Neither reply was only a hint that withheld the correction.

On the partial-answer turn, section 13 repeats section 12. `gpt-4o-mini` left understanding at `unknown` and did not say what the student had already got right. `gpt-4.1-mini` set understanding to `partial` and added the missing request and response. On the third turn `gpt-4.1-mini` set understanding to `correct` even though that turn was an advance with no new student answer. The server still moved from `objective` to `explain`, which that state forces. The label is not evidence that the student answered.

Provider time by matched turn, section 13 only: `gpt-4.1-mini` was lower on turns 1 and 2 (1,331.2 and 1,217.4 ms against 1,938.9 and 1,247.5 ms) and higher on turns 3, 4, and 5 (1,864.5, 1,519.0, and 2,291.1 ms against 1,840.5, 1,323.2, and 2,006.9 ms). The first `gpt-4o-mini` total also includes a 297.4 ms prepare. Across the two samples, `gpt-4.1-mini` is not consistently faster, and its misconception call is the slower of the two whenever both calls are accepted.

### Cost of this sample

Published uncached rates, same sources as section 12: `gpt-4o-mini` $0.15 / $0.60 per million input and output tokens, `gpt-4.1-mini` $0.40 / $1.60. All ten turns were accepted, so every turn has a usage row. The stored `costMicros` still uses the $0.15 / $0.60 constants for both models and is not used here.

| Model        | Turns | Input tokens | Output tokens | List-price estimate |
| ------------ | ----- | ------------ | ------------- | ------------------- |
| gpt-4o-mini  | 5     | 6,108        | 677           | $0.00132            |
| gpt-4.1-mini | 5     | 6,108        | 840           | $0.00379            |

Input counts match turn for turn. The output difference is 163 tokens, mostly on the misconception turn (181 against 286). The `gpt-4.1-mini` estimate is about 2.9 times the current model on this script. Cached-input pricing was not applied because the stored usage has no cached-token count.

### Configuration and checks

`.env` was read after the test processes exited. `AI_TEACH_MODEL` is `gpt-4o-mini`. The two test students are new local accounts on the first lesson. Their sessions were not completed. No other student record was edited. No application code changed, so the test suite, lint, typecheck, and production build were not run. A cached test replay would not be new evidence. The browser was not opened.

### Decision

Keep `gpt-4o-mini`.

`gpt-4.1-mini` accepted the misconception turn in both samples. `gpt-4o-mini` rejected it once and accepted it once. When both accepted it, both corrected the false claim. `gpt-4.1-mini` also marked the partial answer in both samples, which `gpt-4o-mini` did not. That is a teaching difference on two pairs of turns. It is not a latency win: the second sample is slower for `gpt-4.1-mini` on three of five turns, including the misconception turn, and the list price is higher. Two sessions are too small to change the production model.

That larger sample is section 14.

## 14. Larger matched sample, 10 October 2026

Three new sessions per model, five planned turns each, 30 planned turns. The script, lesson, and inputs are the ones in section 12. Sections 12 and 13 are unchanged. Each session used a new verified student with the same starting lesson and the display name used in section 12. Requests were sequential. Run order was `gpt-4o-mini` A, `gpt-4.1-mini` A, `gpt-4.1-mini` B, `gpt-4o-mini` B, `gpt-4o-mini` C, `gpt-4.1-mini` C. Each session was a fresh local API process, so neither model’s sessions were all first or all last. `gpt-4.1-mini` was a process override. `.env` was not edited.

After session A, the runner stopped a session at the first non-200 turn. The state machine still required an answer, so later advances would not have been the scripted states. Session A had already sent those later turns. They are listed and are not treated as the scripted explain, check, or misconception turns.

### Per request

Durations are milliseconds from `teach_timing`, to one decimal. `—` means the span was null. Tokens are from `ai_usage`. A schema rejection writes no usage row. Prompt time was under 1 ms on every call that built a prompt.

| Request     | Model        | Session | Kind                                     | Reached provider | HTTP | Schema / state                      | Understanding | provider | total  | In   | Out |
| ----------- | ------------ | ------- | ---------------------------------------- | ---------------- | ---- | ----------------------------------- | ------------- | -------- | ------ | ---- | --- |
| s49-4o-a-1  | gpt-4o-mini  | A       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1470.1   | 1631.2 | 1219 | 125 |
| s49-4o-a-2  | gpt-4o-mini  | A       | partial answer                           | yes              | 503  | `invalid_response`                  | —             | 1140.3   | 1178.0 | —    | —   |
| s49-4o-a-3  | gpt-4o-mini  | A       | advance                                  | no               | 400  | `VALIDATION`, answer still required | —             | —        | 8.2    | —    | —   |
| s49-4o-a-4  | gpt-4o-mini  | A       | advance                                  | no               | 400  | `VALIDATION`, answer still required | —             | —        | 5.8    | —    | —   |
| s49-4o-a-5  | gpt-4o-mini  | A       | misconception text, still in prior_check | yes              | 503  | `invalid_response`                  | —             | 1855.0   | 1888.6 | —    | —   |
| s49-4o-b-1  | gpt-4o-mini  | B       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1454.7   | 1553.6 | 1219 | 146 |
| s49-4o-b-2  | gpt-4o-mini  | B       | partial answer                           | yes              | 200  | accepted, objective                 | unknown       | 1449.9   | 1516.4 | 1185 | 117 |
| s49-4o-b-3  | gpt-4o-mini  | B       | advance                                  | yes              | 200  | accepted, explain                   | unknown       | 1465.0   | 1559.8 | 1242 | 128 |
| s49-4o-b-4  | gpt-4o-mini  | B       | advance                                  | yes              | 200  | accepted, comprehension_check       | unknown       | 1305.5   | 1477.1 | 1240 | 111 |
| s49-4o-b-5  | gpt-4o-mini  | B       | misconception                            | yes              | 200  | accepted, adapt                     | incorrect     | 1567.8   | 1667.8 | 1217 | 155 |
| s49-4o-c-1  | gpt-4o-mini  | C       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1470.1   | 1563.2 | 1219 | 129 |
| s49-4o-c-2  | gpt-4o-mini  | C       | partial answer                           | yes              | 503  | `invalid_response`                  | —             | 1424.3   | 1464.1 | —    | —   |
| s49-4o-c-3  | gpt-4o-mini  | C       | advance                                  | not sent         | —    | blocked by turn 2                   | —             | —        | —      | —    | —   |
| s49-4o-c-4  | gpt-4o-mini  | C       | advance                                  | not sent         | —    | blocked by turn 2                   | —             | —        | —      | —    | —   |
| s49-4o-c-5  | gpt-4o-mini  | C       | misconception                            | not sent         | —    | blocked by turn 2                   | —             | —        | —      | —    | —   |
| s49-41m-a-1 | gpt-4.1-mini | A       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1563.7   | 1660.5 | 1219 | 148 |
| s49-41m-a-2 | gpt-4.1-mini | A       | partial answer                           | yes              | 200  | accepted, objective                 | partial       | 1614.8   | 1676.1 | 1185 | 123 |
| s49-41m-a-3 | gpt-4.1-mini | A       | advance                                  | yes              | 200  | accepted, explain                   | unknown       | 1552.8   | 1611.0 | 1242 | 154 |
| s49-41m-a-4 | gpt-4.1-mini | A       | advance                                  | yes              | 200  | accepted, comprehension_check       | unknown       | 1502.8   | 1559.6 | 1240 | 149 |
| s49-41m-a-5 | gpt-4.1-mini | A       | misconception                            | yes              | 200  | accepted, adapt                     | incorrect     | 1610.1   | 1709.2 | 1217 | 181 |
| s49-41m-b-1 | gpt-4.1-mini | B       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1892.6   | 1968.5 | 1219 | 134 |
| s49-41m-b-2 | gpt-4.1-mini | B       | partial answer                           | yes              | 200  | accepted, objective                 | partial       | 1272.5   | 1332.2 | 1185 | 123 |
| s49-41m-b-3 | gpt-4.1-mini | B       | advance                                  | yes              | 200  | accepted, explain                   | unknown       | 1456.7   | 1526.0 | 1242 | 130 |
| s49-41m-b-4 | gpt-4.1-mini | B       | advance                                  | yes              | 200  | accepted, comprehension_check       | unknown       | 1314.4   | 1381.1 | 1240 | 143 |
| s49-41m-b-5 | gpt-4.1-mini | B       | misconception                            | yes              | 200  | accepted, adapt                     | incorrect     | 1759.8   | 1839.4 | 1217 | 197 |
| s49-41m-c-1 | gpt-4.1-mini | C       | first advance                            | yes              | 200  | accepted, prior_check               | unknown       | 1449.1   | 1583.7 | 1219 | 135 |
| s49-41m-c-2 | gpt-4.1-mini | C       | partial answer                           | yes              | 200  | accepted, objective                 | partial       | 1289.4   | 1374.4 | 1185 | 124 |
| s49-41m-c-3 | gpt-4.1-mini | C       | advance                                  | yes              | 200  | accepted, explain                   | unknown       | 1262.3   | 1339.3 | 1242 | 130 |
| s49-41m-c-4 | gpt-4.1-mini | C       | advance                                  | yes              | 200  | accepted, comprehension_check       | unknown       | 1199.1   | 1277.2 | 1240 | 121 |
| s49-41m-c-5 | gpt-4.1-mini | C       | misconception                            | yes              | 200  | accepted, adapt                     | incorrect     | 2399.5   | 2544.9 | 1217 | 302 |

Planned 30. Sent 27. Not sent 3, all after `gpt-4o-mini` session C’s schema failure. Reached the provider 26. Did not reach the provider 2, both `VALIDATION` in session A after the failed partial answer. Schema accepted 22. Schema rejected 3, all `gpt-4o-mini`, all `invalid_response`, all HTTP 503. Timeouts 0. Retries 0. Full five-turn scripts completed: `gpt-4o-mini` 1 of 3, `gpt-4.1-mini` 3 of 3. The rejected bodies were not logged.

Provider-latency summaries below exclude the two validation turns and the three unsent turns. They include schema failures that did reach the provider. Session A turn 5 is excluded from the misconception row because the session was still in `prior_check`. Means and medians are descriptive. They are not a significance test. `n=1` has no median.

| Turn                            | gpt-4o-mini provider, ms                                 | gpt-4.1-mini provider, ms                                |
| ------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| 1 opening                       | n=3, mean 1,465.0, median 1,470.1, range 1,454.7–1,470.1 | n=3, mean 1,635.1, median 1,563.7, range 1,449.1–1,892.6 |
| 2 partial answer                | n=3, mean 1,338.2, median 1,424.3, range 1,140.3–1,449.9 | n=3, mean 1,392.2, median 1,289.4, range 1,272.5–1,614.8 |
| 3 explain                       | n=1, 1,465.0                                             | n=3, mean 1,424.0, median 1,456.7, range 1,262.3–1,552.8 |
| 4 check                         | n=1, 1,305.5                                             | n=3, mean 1,338.7, median 1,314.4, range 1,199.1–1,502.8 |
| 5 misconception, intended state | n=1, 1,567.8                                             | n=3, mean 1,923.1, median 1,759.8, range 1,610.1–2,399.5 |

Turns 1–4 that reached the provider: `gpt-4o-mini` n=8, mean 1,397.5, median 1,452.3; `gpt-4.1-mini` n=12, mean 1,447.5, median 1,452.9. The medians match. The misconception calls that stayed in the scripted state were slower for `gpt-4.1-mini` in all three of its sessions than the one accepted `gpt-4o-mini` call.

### Quality

The same reading of accepted speech was used for both models. Schema acceptance is separate from that reading.

| Turn              | gpt-4o-mini                                                                                                                                                                                                                                                                            | gpt-4.1-mini                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening           | 3 of 3 accepted. Each states the request, the response, and showing the page, and each names sorğu, cavab, and göstərmə before asking a question.                                                                                                                                      | 3 of 3 accepted. Each states the same three-part path. Two ask which protocol is used. One asks what the three steps are called before naming them.                                                              |
| Partial answer    | 1 of 3 accepted. That reply leaves understanding at `unknown`, restates the request and response, and does not say what the student already had right. The other two calls reached the provider and failed the schema, so there is no speech to score.                                 | 3 of 3 accepted, all `partial`, all moved to `objective`. Each agrees that the browser opens the address and shows the page, names the missing request and response, and asks how the browser sends the request. |
| Explain and check | Only session B reached these states. The speech is technically correct and again lists the three steps before the question. The check turn states the steps and does not ask the student to supply them.                                                                               | 3 of 3 reached both states. The speech is technically correct. The three steps are stated before or inside the question.                                                                                         |
| Misconception     | Only session B reached `comprehension_check`. Understanding `incorrect`, state `adapt`. The speech says the claim is wrong and that the browser sends an HTTP request first. It does not explicitly say the browser does not create the HTML. It asks which request the browser sends. | 3 of 3: understanding `incorrect`, state `adapt`. Each says the browser does not create the HTML, restates the request and the HTML response, and asks a follow-up about the step before the page is shown.      |

Both models give the lesson’s three-step account early. That is premature disclosure of the path the check is meant to elicit. `gpt-4.1-mini` is the one that consistently recognizes the partial answer and the misconception. `gpt-4o-mini` did both only in the single session that got past turn 2, and its partial-answer reply still did not mark the answer `partial`.

### Cost

Uncached published rates, because stored usage has no cached-token count: `gpt-4o-mini` $0.15 / $0.60 per million input and output tokens, `gpt-4.1-mini` $0.40 / $1.60. Failed turns have no usage row. The stored `costMicros` constants are not used for `gpt-4.1-mini`.

| Session        | Accepted turns with usage | Input | Output | Estimate |
| -------------- | ------------------------- | ----- | ------ | -------- |
| gpt-4o-mini A  | 1                         | 1,219 | 125    | $0.00026 |
| gpt-4o-mini B  | 5                         | 6,103 | 657    | $0.00131 |
| gpt-4o-mini C  | 1                         | 1,219 | 129    | $0.00026 |
| gpt-4.1-mini A | 5                         | 6,103 | 755    | $0.00365 |
| gpt-4.1-mini B | 5                         | 6,103 | 727    | $0.00360 |
| gpt-4.1-mini C | 5                         | 6,103 | 812    | $0.00374 |

A completed five-turn session costs about $0.00131 on `gpt-4o-mini` and $0.00360–$0.00374 on `gpt-4.1-mini`, about 2.8 times more. Summing every usage row, $0.00183 against $0.01099, overstates the ratio because two `gpt-4o-mini` sessions wrote only the opening turn.

### Configuration

After the test processes were stopped, `.env` still had `AI_TEACH_MODEL=gpt-4o-mini`. The six students are new local accounts. Their lessons were not completed, except that the learning rows from the accepted turns remain. No other student was edited. No application code changed. Tests, lint, typecheck, the production build, and the browser were not run. A cached suite would not add evidence for this measurement. Process shutdowns after each session were intentional and are not model failures.

### Decision

Keep `gpt-4o-mini`.

`gpt-4.1-mini` was more consistent on this script: three finished sessions, partial answers marked `partial`, and three corrected misconceptions. `gpt-4o-mini` finished one session. Two partial-answer calls failed the schema and stopped the lesson. That is a real reliability difference in this sample of three. It is not a latency advantage, and a finished session costs about 2.8 times more. Sections 12 and 13 already showed the same partial-answer teaching gap and no stable speed win, while `gpt-4o-mini` did accept this partial answer in both of those earlier sessions. Three sessions are not a reason to change the production model. Switching models inside one lesson would also change the teacher’s voice from turn to turn, so this sample does not justify a routing design.

Further repeats of this five-turn comparison are not the next use of time. The provider call is still the wait, and the more expensive model was not faster here. That streaming probe is the next section.

## Streaming Feasibility Probe

Date: 10 October 2026. Production streaming was not implemented. The teaching endpoint, the provider adapter, the prompts, the schema, and the saved model were not changed. `.env` still has `AI_TEACH_MODEL=gpt-4o-mini`.

### Current behavior

`OpenAiCompatibleProvider.complete` posts once to `/chat/completions` with `response_format: json_object` and no `stream` field. It reads the full body, then parses JSON. `LessonExperience` waits for that JSON. `packages/curriculum/src/teaching-stream.ts` builds events after a finished turn and is not an HTTP stream. A failed or partial model body does not commit learning state. The claim is failed and the client receives 503.

### Baseline

One new verified student, local API, lesson `how-the-web-delivers-a-page`, one advance from `created`. Correlation id `stream-base-1`. This is a new request, not a row from sections 11–14.

| Field                 | Value                                |
| --------------------- | ------------------------------------ |
| Model                 | gpt-4o-mini                          |
| HTTP                  | 200                                  |
| Outcome               | success                              |
| State after the turn  | prior_check                          |
| Schema                | accepted by the existing server path |
| prepare_ms            | 126.4                                |
| prompt_ms             | 0.5                                  |
| provider_ms           | 1,734.2                              |
| commit_ms             | 42.9                                 |
| total_ms              | 1,904.3                              |
| HTTP durationMs       | 1,910                                |
| Input / output tokens | 1,219 / 130                          |

The provider call is 1,734.2 of the 1,904.3 ms server total. The API process was stopped after this turn. That shutdown is not a request failure.

### What was tested

The adapter itself was not modified. A temporary script outside the repository called the same URL with the same model, temperature 0.2, `max_tokens` 800, JSON object format, and one added field: `stream: true`. The prompt was built with `renderTeachPrompt` and `buildTeacherContext` for a first advance: state `created`, explain mode, empty history, empty student message, the first lesson’s reading block, and the name Bench. System text was 3,284 characters, which matches `teacher.system.v3`. User text was 1,932 characters. The live baseline prompt was not captured, so the two prompts are equivalent in construction and are not known to be byte-identical. The script was deleted after the run. It wrote no teaching row.

The provider was contacted. The response was HTTP 200. The returned model id was `gpt-4o-mini-2024-07-18`. One request. No mock. No second call. No cancellation was sent. The clock is `performance.now()`.

| Mark                                       | ms from request start |
| ------------------------------------------ | --------------------- |
| Response headers                           | 865.8                 |
| First body byte                            | 866.5                 |
| First non-empty content delta              | 868.5                 |
| First character inside the `speech` string | 871.1                 |
| `speech` string closed                     | 1,861.1               |
| Stream finished, including `[DONE]`        | 2,103.2               |

166 of 168 server-sent events carried content. The content was one JSON document assembled from those fragments. It parsed, passed `parseTeacherResult`, and passed `normalizeTeacherOutput` for a `created` explain turn. No stream error was observed. Token usage was not included. The production request does not ask for usage on a stream, and this probe did not add that option.

The first body byte is not teaching text. The first content delta and the first speech character are 2.6 ms apart, so the JSON before `speech` is short. The speech string then stayed open until 1,861.1 ms. Bytes continued after that until 2,103.2 ms, so the document was still incomplete when the speech string closed. A finished speech string was not yet a validated teacher result.

### Comparison

One stream and one baseline. Output length differed: the baseline speech was 270 characters and the streamed speech field was 377. Do not treat the gap as a stable speedup.

The validated stream finished at 2,103.2 ms. The baseline provider call finished at 1,734.2 ms and the baseline server turn at 1,904.3 ms. On this pair, streaming did not produce a validated answer sooner. The first speech character arrived at 871.1 ms, about 1.0 s before the baseline server total. That character is the start of a JSON string, not a complete sentence. The speech string closed at 1,861.1 ms, which is in the same range as the baseline’s full turn.

### Integrity

Partial chunks are fragments of the teacher JSON. Showing them raw would show braces, field names, and unfinished strings. The speech field can be separated from the rest only by parsing an incomplete document. Other fields, including understanding and proposed learning updates, are not safe to show.

The server can display nothing until `normalizeTeacherOutput` accepts the full document. That is what the current path does. If a later field fails, speech that was already shown would have to be withdrawn, and it must not have changed mastery or the lesson state. The probe did not commit anything. A production stream would still create the turn claim before the provider call, as it does now, and would call `failTurn` if the stream times out, aborts, or fails validation. A timeout after some chunks was not observed. The existing 20 second `AbortSignal.timeout` can abort the connection. The browser client still has no abort of its own.

`packages/curriculum/src/teaching-stream.ts` does not solve this. It emits `teacher.started` and `teacher.completed` only after a finished turn.

### Options

A. Keep one JSON response. The student waits for validation. The adapter, the HTTP shape, and the learning commit stay as they are. This sample gives no completed-answer time to beat. Confidence in leaving this in place is high.

B. Stream inside the server, buffer, validate, then return the same JSON. The browser still waits for the full document. Perceived wait does not change. The extra read loop can fail after partial chunks and must still fail the claim. This adds a second provider mode without a student-visible gain.

C. A separate event stream that sends only extracted speech text, then one validated final result. The first speech character in this sample arrived at 871.1 ms, so text could start to appear during the wait. The API and the web client would need a new response shape. Speech shown early can still be rejected by the schema, so the client must be able to replace it. Scoring and progression stay on the final validated result. Cancellation must fail the claim rather than leave it pending. This is a product and protocol change, not a switch in the adapter. One request is not evidence that the completed answer arrives sooner.

Raw JSON tokens should not be sent to the browser.

### Recommendation

Keep option A. The provider can stream this model’s JSON object. That was tested once. The validated result was not earlier than the ordinary advance measured just before it. Progressive speech would be option C, and it should wait for a product decision rather than follow from this single probe. Production streaming was not added.

## Teacher Response Schema Reliability Audit

Date: 10 October 2026. Diagnostic only. The saved model stayed `gpt-4o-mini`. Prompts, schema, normalizer, temperature, token cap, retries, and application code were not changed.

`invalid_response` is one label for several failures. The HTTP body is always 503 `AI_UNAVAILABLE` with “The teacher is temporarily unavailable.” That status is the teaching error mapping in `aiFailure`. It is not, by itself, a provider outage.

### Where a response becomes `invalid_response`

Verified from the current source:

| Layer                                                                  | What happens                                                              | Logged code                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Provider HTTP 401/403, 429, 408, 5xx                                   | `providerErrorCode` in `packages/ai/src/provider/errors.ts`               | `authentication`, `rate_limit`, `timeout`, `unavailable` |
| Provider HTTP 4xx that is not those statuses and not a safety word     | Same function                                                             | `invalid_response`                                       |
| Empty envelope, empty `choices`, or empty message content              | `readContent` in `packages/ai/src/provider/openai-compatible.provider.ts` | `invalid_response`                                       |
| Message content that is not JSON                                       | `JSON.parse` in `complete`                                                | `malformed_json`                                         |
| JSON that fails `teacherResultSchema`                                  | `parseTeacherResult` discards the Zod issue and throws                    | `invalid_response`                                       |
| Speech that matches the internal-leak pattern after a successful parse | `normalizeTeacherOutput`                                                  | `invalid_response`                                       |
| Answer required, or advance when an answer is required                 | `prepareTurn`, before a claim                                             | HTTP 400 `VALIDATION`. The provider is not called.       |

`failTurn` stores `status`, `httpStatus`, `code`, and the generic message. It does not store the model JSON or the Zod path. `teach_timing` stores the error code and the four spans. A failed turn writes no `ai_usage` row. Zod’s `invalid_value` issue lists the allowed enum and the path. It does not include the rejected value.

A provider span of about 1–2 seconds followed by a commit of about 7–13 ms fits both a provider 4xx and a schema rejection after HTTP 200. The span times do not separate those two. `malformed_json`, `timeout`, `unavailable`, `authentication`, and `rate_limit` would have been logged under those codes. The historical and reproduced failures were logged as `invalid_response`.

The fake teaching test that sets `failure = "invalid"` returns `{ speech: "" }`. That fails the speech length rule. It is a mock of a different deviation. The provider unit test that returns `not-json` expects `malformed_json`.

### Existing failure evidence

Bodies for Steps 44.7–44.9 were not logged. Field-level deviations for those turns are unavailable. The rows below are application logs.

| Turn                   | Model        | Scenario                                        | Reached provider | HTTP | Logged code        | Provider ms | Commit ms | Evidence                                                                               |
| ---------------------- | ------------ | ----------------------------------------------- | ---------------- | ---- | ------------------ | ----------- | --------- | -------------------------------------------------------------------------------------- |
| bench-4omini-5         | gpt-4o-mini  | misconception, comprehension check              | yes              | 503  | `invalid_response` | 1,872.5     | 11.7      | Application log. Body unavailable.                                                     |
| bench-41nano-5         | gpt-4.1-nano | misconception, comprehension check              | yes              | 503  | `invalid_response` | 1,956.0     | 13.3      | Application log. Not the saved model. Body unavailable.                                |
| s49-4o-a-2             | gpt-4o-mini  | partial answer, `prior_check`                   | yes              | 503  | `invalid_response` | 1,140.3     | 7.2       | Application log. Body unavailable.                                                     |
| s49-4o-a-3, s49-4o-a-4 | gpt-4o-mini  | later advances                                  | no               | 400  | `VALIDATION`       | —           | —         | Answer still required. These are not schema failures.                                  |
| s49-4o-a-5             | gpt-4o-mini  | misconception text while still in `prior_check` | yes              | 503  | `invalid_response` | 1,855.0     | 7.7       | Application log. This was not the scripted comprehension-check turn. Body unavailable. |
| s49-4o-c-2             | gpt-4o-mini  | partial answer, `prior_check`                   | yes              | 503  | `invalid_response` | 1,424.3     | 7.0       | Application log. Later turns were not sent. Body unavailable.                          |

Step 44.8 had no `invalid_response`. In Step 44.9, `gpt-4.1-mini` accepted all 15 turns. The three schema-labeled rejections were all `gpt-4o-mini`.

### Reproduction

Two new verified students, display name Bench, lesson `how-the-web-delivers-a-page`, saved model `gpt-4o-mini`. Legal sequence only: open a session, advance, then the partial answer “Brauzer ünvanı açır və səhifəni ekranda göstərir.” The second session stopped after the partial answer returned 503. A third student was not created.

The application does not keep the rejected JSON. After that 503, two diagnostic completions used the same prompt builder, the same generation settings (`temperature` 0.2, `max_tokens` 800, `response_format` `json_object`, model `gpt-4o-mini`), the stored teacher speech from the successful advance, and `teacherResultSchema.safeParse`. Those two calls are new provider responses. They are not the bytes the API discarded. The diagnostic script lived outside the repository and was removed. Speech was not recorded.

`prior_check` is a question state, so `currentTeachingBlock` selects the lesson block whose `type` is `check_question`. That block is inside the trusted lesson packet. The explain-mode line also says “one check question.” The system prompt’s allowed `suggestedState` list contains `comprehension_check` and does not contain `check_question`.

### Results

| Call                            | Outcome                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student A advance `schema-a1-1` | HTTP 200. State `prior_check`. Provider 1,440.0 ms, commit 41.8 ms, total 1,529.2 ms.                                                                                                                                                                                                                                              |
| Student A partial `schema-a1-2` | HTTP 200. Understanding `unknown`. State `objective`. Provider 1,361.5 ms, commit 31.8 ms, total 1,418.4 ms.                                                                                                                                                                                                                       |
| Student B advance `schema-a2-1` | HTTP 200. State `prior_check`. Provider 1,662.8 ms, commit 49.8 ms, total 1,728.7 ms.                                                                                                                                                                                                                                              |
| Student B partial `schema-a2-2` | HTTP 503. `teach_timing` outcome `error`, error `invalid_response`, model `gpt-4o-mini`. Provider 1,670.8 ms, commit 9.2 ms, total 1,707.9 ms. HTTP duration 1,719 ms. No usage row. Body not stored.                                                                                                                              |
| Diagnostic completion 1         | Provider HTTP 200, model `gpt-4o-mini-2024-07-18`, `finish_reason` `stop`. JSON parsed. Keys were the eight contract keys. `teacherResultSchema` failed with `invalid_value` at `suggestedState`. The rejected token was not in the Zod issue, and this call did not print the field.                                              |
| Diagnostic completion 2         | Provider HTTP 200, same model, `finish_reason` `stop`. Keys were the eight contract keys. `understanding` was `unknown`. `homework`, `misconception`, and `cacheableExplanation` were null. `skillUpdates` and `memoryNotes` were empty. `suggestedState` was the string `check_question`. Schema failed only at `suggestedState`. |

Local schema checks, with no provider call, accept `suggestedState` `null` and `"objective"`. They reject `"check_question"`, `"Objective"`, `"next"`, and `""` with `invalid_value` at `suggestedState`.

### Classification

Observed facts:

- The reproduced application failure is `invalid_response` after a completed provider span. It is not `malformed_json`, `timeout`, `unavailable`, `authentication`, or `rate_limit`.
- The captured provider document that failed validation was HTTP 200 JSON. It was not empty, and it parsed. The only deviation was `suggestedState: "check_question"`.
- `check_question` is a lesson block type. It is not a member of `TEACHING_STATES`. `parseTeacherResult` rejects the whole object before the normalizer’s leak check.
- The same partial-answer prompt can also succeed. Student A’s partial answer was accepted with `understanding` `unknown`.

Hypothesis for the application 503 on `schema-a2-2`: the discarded body failed the same enum check. Confidence is high. The two diagnostic completions used that turn’s prompt construction, and both failed only at `suggestedState`. The discarded bytes themselves were not read.

Hypothesis for the Step 44.7 and 44.9 `invalid_response` rows: the same enum miss, because those turns were also in `prior_check` or `comprehension_check`, and both states put the `check_question` block in the packet. Confidence is medium. Their bodies were not stored, so a provider 4xx or a different schema path remains possible for those older rows.

This is model output. The prompt shows the block type `check_question` beside a `suggestedState` field that must be a teaching state. The schema is rejecting a value outside its enum. The normalizer did not run on the captured failure. Nothing in the timings indicates an outage.

### Smallest follow-up

Add one prompt constraint: `suggestedState` must be null or one of the listed teaching states, and the lesson block type, including `check_question`, is not a state. Leave the enum as it is. Do not accept `check_question` as a teaching state, and do not rewrite an unknown `suggestedState` into null.

### Tests required before a fix

- `parseTeacherResult` on an otherwise valid object with `suggestedState: "check_question"` throws `AIProviderError` with code `invalid_response`.
- The same helper accepts `null` and `comprehension_check`.
- After the prompt sentence is added, a prompt test asserts that the rendered instructions tell the model not to copy the block type into `suggestedState`.
- A live model call is not a reliable gate. Student A and Student B already differed on the same partial answer.

## Internal AI Failure Diagnostics

Date: 10 October 2026. The public teaching error is unchanged. A provider, schema, JSON, or leak failure is still HTTP 503 `{ code: "AI_UNAVAILABLE", message: "The teacher is temporarily unavailable." }`. `input_too_large` is still HTTP 400 `VALIDATION`. The teacher prompt, schema, allowed states, normalizer rules, model, and learning updates are unchanged.

`invalid_response` remains the provider error code for several different failures. It is not, by itself, evidence of a schema rejection. The teaching timing log now records a separate internal category.

### Internal categories

`teach_timing.error` uses `AIProviderError.failureCategory` when one is set, and otherwise the existing provider code.

| Condition                                                  | Existing `code`    | Timing `error`             | HTTP status kept                    |
| ---------------------------------------------------------- | ------------------ | -------------------------- | ----------------------------------- |
| Provider HTTP 401 or 403                                   | `authentication`   | `authentication`           | yes                                 |
| Provider HTTP 429                                          | `rate_limit`       | `rate_limit`               | yes                                 |
| Provider HTTP 408                                          | `timeout`          | `timeout`                  | yes                                 |
| Provider HTTP 5xx                                          | `unavailable`      | `unavailable`              | yes                                 |
| Safety word in a provider error body                       | `safety_refusal`   | `safety_refusal`           | yes                                 |
| Other provider HTTP 4xx                                    | `invalid_response` | `provider_http_error`      | yes                                 |
| HTTP 200 with no choices or empty content                  | `invalid_response` | `empty_provider_response`  | no, the call succeeded              |
| Envelope or message content is not JSON                    | `malformed_json`   | `malformed_json`           | no                                  |
| `teacherResultSchema` rejects the object                   | `invalid_response` | `teacher_schema_rejection` | no                                  |
| Speech matches the internal-leak check after a valid parse | `invalid_response` | `internal_leak_rejection`  | no                                  |
| Provider status that matches none of the codes above       | `unknown`          | `unknown_ai_failure`       | yes, when the response had a status |

A fetch failure or abort still uses `unavailable` or `timeout` and has no HTTP status. A turn rule such as `VALIDATION` is unchanged and is not an AI category.

### Safe metadata

The timing event still has the correlation id, provider, model, outcome, and the four spans. It now also has `http_status` and `schema_issues`. Each schema issue is only a field path and a Zod issue code, at most eight issues. A path or code that is not a short token is dropped. The rejected value, the provider body, the prompt, and the student message are not stored on the error and are not written to this log.

`failTurn` still stores `AI_UNAVAILABLE` and the public message. A replay of a failed turn does not reveal the internal category.

### Tests

Focused AI tests covered schema rejection versus malformed JSON, empty content, provider HTTP 400 versus 401 versus 503, and the leak category. The teaching HTTP test sent four failed advances and checked one timing event each: `teacher_schema_rejection` with path `suggestedState`, `malformed_json`, `provider_http_error` with status 400, and `internal_leak_rejection`. Each response stayed 503 `AI_UNAVAILABLE`. The serialized timing events did not contain the model speech, the rejected state token, the leak sample, or the system-prompt text. Correlation ids and the existing spans were present.

### Remaining ambiguity

The log names the schema field and the issue code. It does not name the rejected value, so an `invalid_value` on `suggestedState` does not say which token the model sent. Turns recorded before this change still have only `invalid_response` and no issue path. Code review, interview, speaking, and project review keep their own `invalid_response` throws. They pick up the shared adapter categories for HTTP errors, empty content, and malformed JSON.

## Live Verification of suggestedState Prompt Fix

Date: 10 October 2026. Bounded check of the Step 45.2 sentence on the saved model `gpt-4o-mini`. No application code, prompt, schema, or configuration was changed for this run. The running API used the built system prompt that contains: `suggestedState must be null or a listed teaching state; the lesson block type check_question is not a teaching state.` Timing events included `http_status` and `schema_issues`.

Six new verified students, display name Bench, lesson `how-the-web-delivers-a-page`. Each session opened through the teaching endpoint, then one advance. A partial answer was sent only when that advance returned state `prior_check`. The partial answer was “Brauzer ünvanı açır və səhifəni ekranda göstərir.” No retries. A session stopped when the advance or the partial answer was not HTTP 200. Provider calls: 8. Cap was 12.

### Outcomes

| Correlation    | Turn           | HTTP | Timing error               | Schema issue                       | Provider ms |
| -------------- | -------------- | ---- | -------------------------- | ---------------------------------- | ----------- |
| `live454-s1-1` | advance        | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 3,612.0     |
| `live454-s2-1` | advance        | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 2,026.9     |
| `live454-s3-1` | advance        | 200  | none                       | none                               | 2,059.8     |
| `live454-s3-2` | partial answer | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 1,508.2     |
| `live454-s4-1` | advance        | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 1,581.1     |
| `live454-s5-1` | advance        | 200  | none                       | none                               | 1,750.4     |
| `live454-s5-2` | partial answer | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 2,253.8     |
| `live454-s6-1` | advance        | 503  | `teacher_schema_rejection` | `suggestedState` / `invalid_value` | 1,768.7     |

Model on every timing event: `gpt-4o-mini`. Provider: `openai-compatible`. Public error on each 503: `AI_UNAVAILABLE`. No `malformed_json`, `empty_provider_response`, `provider_http_error`, or pre-provider `VALIDATION`. The rejected token was not logged.

Partial answers attempted: 2. Accepted: 0. `teacher_schema_rejection`: 2. Provider time for those two calls: 1,508.2 ms and 2,253.8 ms. Four sessions never sent a partial answer because the advance itself was rejected. Those four advances are not partial-answer results. They did reach the provider, and each was the same schema issue.

### Comparison

Before the prompt sentence, Step 45.1 recorded one application partial-answer failure and two diagnostic completions that failed `suggestedState`. One of those completions had the token `check_question`. Opening advances in that two-student sample were accepted. Step 44.9 recorded two `gpt-4o-mini` partial-answer failures as `invalid_response`, without a field path.

In this sample the same field and issue code appeared on both partial answers and on four of six opening advances. The token was not read, so this does not prove every rejection was still `check_question`. It does show that the sentence did not stop `suggestedState` / `invalid_value` on the real teaching path. Six model calls in one afternoon are not a rate and do not measure teaching quality.

### Recommendation

Do not treat the prompt sentence as a fix. The next change should leave `check_question` out of the teaching-state enum. The server already decides the next state. An unrecognized `suggestedState` can be dropped and logged without failing the rest of a schema-valid turn. That is a behavior change and was not made here.

## Safe Recovery for Invalid suggestedState

Date: 10 October 2026. `check_question` is still not a teaching state. The allowed enum is unchanged. The Step 45.2 prompt sentence is unchanged. `AI_TEACH_MODEL` remains `gpt-4o-mini`.

### Why a missing suggestion is safe

`resolveTeachingTransition` owns the next state. Its `suggestedState` argument is optional. `normalizeTeacherTurn` passes `parsed.suggestedState ?? undefined`. `null` and a missing value both mean there is no suggestion. For a forced step, including `created` to `prior_check` and `explain` to `comprehension_check`, the server uses the forced state. A suggestion is applied only when it is one of the legal choices for that step. An unknown token cannot be one of those choices, because it is not a `TeachingState`.

`TeacherResult.suggestedState` is `TeachingState | null`. `null` is the existing representation of no suggestion. Recovery stores that `null`. It does not store the rejected token, and `suggestionAccepted` is false.

### When recovery runs

Strict `parseTeacherResult` still runs first. Recovery runs only when every Zod issue is `invalid_value` at `suggestedState`, the payload is a JSON object, and parsing the same object with `suggestedState: null` succeeds. The internal-leak check still runs after that parse. The turn is then committed with the server-chosen state.

The timing event for a recovered turn has outcome `success`, error `teacher_schema_rejection`, the correlation id, the existing spans, and `schema_issues` of path `suggestedState` and code `invalid_value`. The rejected value, the response body, and the prompt are not in that event.

### What still fails the turn

Any other schema issue, including an invalid `suggestedState` together with another invalid field. Malformed JSON. An empty provider response. An internal-leak match. A provider HTTP error. `check_question` is not added to the enum. `parseTeacherResult` still throws `teacher_schema_rejection` for that token; only `readTeacherResult` / `normalizeTeacherTurn` recover it.

A recovered opening advance is now HTTP 200 with state `prior_check`, instead of HTTP 503. Other failure responses stay 503 `AI_UNAVAILABLE`.

### Verification

Focused AI tests: 3 files, 26 passed. Focused teaching tests: 3 files, 14 passed. `EXECUTION_MODE=fake pnpm test --concurrency=1`: 20/20 tasks, 16 cached, 501 passed. `pnpm lint`: 11/11, AI and API fresh. `pnpm typecheck`: 22/22, AI and API fresh. `NODE_ENV=production pnpm build`: 11/11, full cache. The AI package was compiled during the test run after this edit.

### Remaining limitation

Recovery matches only the issue code `invalid_value` on `suggestedState`. A different Zod code for that field still rejects the turn. The log still does not record the rejected token. No live provider call was made after this change.

## Live Verification of Safe suggestedState Recovery

Date: 10 October 2026. Six new verified students, display name Bench, lesson `how-the-web-delivers-a-page`, saved model `gpt-4o-mini`. No application code, prompt, schema, or configuration was changed. Each session used the teaching endpoint: one advance, then the partial answer “Brauzer ünvanı açır və səhifəni ekranda göstərir.” only after the advance returned `prior_check`. No retries. Provider calls: 12. Cap was 12.

Recovery is counted only when the timing event has outcome `success`, error `teacher_schema_rejection`, and schema issue `suggestedState` / `invalid_value`. An HTTP 200 with `error: null` and no schema issues is a strict accept. The rejected token was not logged.

### Outcomes

| Correlation    | Turn           | HTTP | Timing        | State         | Provider ms | Total ms |
| -------------- | -------------- | ---- | ------------- | ------------- | ----------- | -------- |
| `live456-s1-1` | advance        | 200  | strict accept | `prior_check` | 3,127.8     | 3,284.3  |
| `live456-s1-2` | partial answer | 200  | recovered     | `objective`   | 2,080.0     | 2,164.5  |
| `live456-s2-1` | advance        | 200  | strict accept | `prior_check` | 1,893.2     | 1,954.6  |
| `live456-s2-2` | partial answer | 200  | recovered     | `objective`   | 1,584.4     | 1,684.9  |
| `live456-s3-1` | advance        | 200  | recovered     | `prior_check` | 3,944.7     | 4,020.2  |
| `live456-s3-2` | partial answer | 200  | recovered     | `objective`   | 2,009.9     | 2,110.7  |
| `live456-s4-1` | advance        | 200  | strict accept | `prior_check` | 1,839.0     | 1,907.7  |
| `live456-s4-2` | partial answer | 200  | recovered     | `objective`   | 1,700.6     | 1,791.5  |
| `live456-s5-1` | advance        | 200  | strict accept | `prior_check` | 2,392.6     | 2,482.6  |
| `live456-s5-2` | partial answer | 200  | recovered     | `objective`   | 1,754.8     | 1,935.6  |
| `live456-s6-1` | advance        | 200  | recovered     | `prior_check` | 2,000.9     | 2,119.2  |
| `live456-s6-2` | partial answer | 200  | strict accept | `objective`   | 3,672.9     | 3,767.5  |

Model on every event: `gpt-4o-mini`. Provider: `openai-compatible`. Every recovered event’s only schema issue was `suggestedState` / `invalid_value`. No public error code. No `malformed_json`, empty response, provider HTTP error, leak rejection, or pre-provider `VALIDATION`.

Strict accepts: 5 (4 advances, 1 partial answer). Recovered accepts: 7 (2 advances, 5 partial answers). Rejected: 0. Sessions completed through both legal turns: 6.

Every advance ended in `prior_check`. Every partial answer ended in `objective`. Those are the forced explain-mode steps. No turn ended in `check_question` or another non-state. Understanding on every partial answer was `unknown`. Provider time across the 12 calls was 1,584.4–3,944.7 ms.

### Limitation

Recovery was exercised by real provider responses. This sample does not show an unrelated schema or safety failure, so live rejection of those cases was not rechecked here; the Step 45.5 tests still cover them. Twelve calls are not a failure rate. The rejected token is still not in the log.

## Cross-Module AI Failure Diagnostics Audit

Date: 10 October 2026. Source and existing tests only. No live provider call, no application change, and no model or configuration change. `suggestedState` recovery stays on the teaching path.

### Modules inspected

Chat completions share `OpenAiCompatibleProvider` from `apps/api/src/modules/ai/ai.module.ts` and `ModelRouter` in `packages/ai/src/router/model-router.ts`. The router serves `teach`, `code_review`, `project_review`, and `interview` at temperature 0.2 and a 20 second timeout. `review`, `classify`, and `summarize` are named in `AI_TASKS` and throw `AiTaskUnavailableError`. No API caller uses them. `model-router.spec.ts` covers that throw.

| Module                   | Entry                                                    | Parser                                                      |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| Teaching                 | `apps/api/src/modules/teaching/teaching.orchestrator.ts` | `readTeacherResult` / `normalizeTeacherTurn`                |
| Code review              | `apps/api/src/modules/exercises/exercise.service.ts`     | `normalizeCodeReviewOutput`                                 |
| Project milestone review | `apps/api/src/modules/projects/project.service.ts`       | `normalizeProjectReviewOutput`, then the code-review parser |
| Project plan review      | same project service                                     | `normalizeProjectPlanReview`                                |
| Interview                | `apps/api/src/modules/interviews/interview.service.ts`   | `normalizeInterviewOutput`                                  |
| Speaking evaluation      | `apps/api/src/modules/speaking/speaking.service.ts`      | `normalizeSpeakingOutput`                                   |
| Speech transcription     | `packages/ai/src/speech/http-speech.ts`                  | transcription JSON `text` field                             |

`admitExplanationCache` is an admission check inside teacher normalization. It is not a provider call. Assessment does not call the provider.

### Shared adapter

`OpenAiCompatibleProvider.complete` asks for `json_object`, parses the envelope, then parses message content. `packages/ai/src/provider/provider.spec.ts` fixes these distinctions on the error object:

| Condition                            | `code`             | `failureCategory`         | `httpStatus` |
| ------------------------------------ | ------------------ | ------------------------- | ------------ |
| 401 or 403                           | `authentication`   | none                      | status       |
| 429                                  | `rate_limit`       | none                      | status       |
| 408                                  | `timeout`          | none                      | status       |
| 5xx                                  | `unavailable`      | none                      | status       |
| other 4xx                            | `invalid_response` | `provider_http_error`     | status       |
| safety body markers                  | `safety_refusal`   | none                      | status       |
| fetch timeout or abort               | `timeout`          | none                      | none         |
| other fetch failure                  | `unavailable`      | none                      | none         |
| empty choices or content             | `invalid_response` | `empty_provider_response` | none         |
| envelope or content that is not JSON | `malformed_json`   | `malformed_json`          | none         |
| oversized input, before fetch        | `input_too_large`  | none                      | none         |

The error message is a fixed sentence. Tests assert that the key and the response body are not in the serialized error. Every chat module receives this object. Only the caller decides whether a log keeps it.

`DisabledAiProvider` throws `authentication` with no category.

### Coverage

| Module              | Parsing                                                                                                               | Schema and safety                                                                                                                          | What a log can separate                                                                                                                                                                                                         | Correlation and timing                                                                                       | Public error                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Teaching            | Provider JSON, then `decodeTeacherJson`                                                                               | Zod. Invalid `suggestedState` can be dropped. Other schema misses and leaks keep categories and sanitized path/code                        | Adapter categories, schema path, leak, timeout, auth, rate limit, availability. Recovery is a success event with `teacher_schema_rejection`                                                                                     | Request correlation. `teach_timing` spans                                                                    | 503 `AI_UNAVAILABLE`. Oversized input is 400 `VALIDATION`         |
| Code review         | Provider JSON object                                                                                                  | Zod in `parseCodeReviewResult`, then leak and unsafe-text checks. Every local failure is `invalid_response` with no category and no issues | Nothing. The warn line is `status=unavailable` and the duration                                                                                                                                                                 | New UUID. One wall-clock duration. No spans                                                                  | 503 `AI_UNAVAILABLE`, including oversized input                   |
| Project review      | Same JSON object, after a full-solution scan                                                                          | Full solution, leak, and schema all throw the same bare `invalid_response`                                                                 | The provider `code` only. `malformed_json`, `timeout`, `authentication`, `rate_limit`, `unavailable`, and `safety_refusal` differ. Empty content, a 4xx, schema failure, a leak, and a full solution all log `invalid_response` | New UUID. Success duration has no model or provider latency. Failure adds `code`                             | 503 `AI_UNAVAILABLE`. Oversized input is 400 `PROJECT_TOO_LARGE`  |
| Project plan        | Hand-read object                                                                                                      | Missing text, a bad list, a secret pattern, or a forbidden literal are the same bare `invalid_response`                                    | Same as project review                                                                                                                                                                                                          | New UUID. Success also logs provider, model, and provider latency                                            | Same as project review                                            |
| Interview           | Hand-read object                                                                                                      | Bad shape, leak, hidden solution, and forbidden literals are the same bare `invalid_response`                                              | Nothing. The warn line is `status=unavailable`                                                                                                                                                                                  | New UUID. One duration                                                                                       | 503 `AI_UNAVAILABLE`, message says the interviewer is unavailable |
| Speaking evaluation | `provider.complete` with schema name `SpeakingResult`. Interview mode uses the interview route; other modes use teach | Same collapse as interview                                                                                                                 | Nothing. The line is `status=ai-unavailable`                                                                                                                                                                                    | The attempt log has a new UUID. The usage row stores `speaking`, or `scripted` on the development fallback   | 503 `AI_UNAVAILABLE`                                              |
| Speech              | Multipart transcription. Reads `text`                                                                                 | No chat schema and no leak category                                                                                                        | Nothing. Timeout, non-OK HTTP, bad JSON, and a missing `text` all become `SpeechUnavailableError`                                                                                                                               | Attempt correlation and `status=speech-unavailable`. Latency is stored only after a successful transcription | 503 `SPEECH_UNAVAILABLE`                                          |

Teaching details are in the Step 45.3 and 45.5 sections. This pass did not change that path.

### Evidence

Confirmed in source:

- The adapter sets `failureCategory` and `httpStatus` before any module parser runs.
- `parseCodeReviewResult`, `normalizeProjectPlanReview`, `normalizeInterviewOutput`, and `normalizeSpeakingOutput` throw `new AIProviderError("invalid_response")` with no details. Leak checks in those files use that same constructor. None call `sanitizeSchemaIssues`.
- `exercise.service.ts` and `interview.service.ts` log a status word. `speaking-log.ts` allows only correlation, status, and duration. `project.service.ts` logs `error.code` for plan and milestone review failures and does not log `failureCategory`, `httpStatus`, or schema issues.
- `speaking.service.ts` `usageFrom` sets `correlationId` to `"speaking"`.
- `http-speech.ts` has one catch path and one `SpeechUnavailableError`.

Confirmed by deterministic tests:

- `provider.spec.ts` separates authentication, a provider 4xx, a 5xx, empty content, and malformed JSON, and checks that bodies stay out of the error.
- Teacher schema and normalize specs, plus `teaching.http.spec.ts`, separate schema recovery, malformed JSON, provider HTTP, and leak in `teach_timing`. The public code stays `AI_UNAVAILABLE`.
- `exercise-review.http.spec.ts` expects 503 for a malformed review object, a timeout, a leak, and a missing route. It does not read the log line.
- `project.http.spec.ts` expects 503 for a full solution, a leak, and a timeout.
- `interview.http.spec.ts` expects 503 for a timeout, no usage row, and a later retry.
- `speaking.http.spec.ts` expects `AI_UNAVAILABLE` for a hostile evaluation and `SPEECH_UNAVAILABLE` when transcription is disabled. Usage JSON must not contain the transcript.
- `speech.spec.ts` expects the same message for HTTP 500, non-JSON, an empty object, and a non-string `text`, and expects the key to stay out of that message.
- Interview and speaking normalizer specs expect `AIProviderError` for bad shapes and leaks. They do not expect a category or a path.

Historical logs in this audit are teaching `teach_timing` events only. No production log store was queried. The live failure mix for code review, projects, interview, speaking, and speech is not observable from this repository.

Not observable:

- Whether current non-teaching models fail schema validation in production.
- Whether a speech failure is a timeout, an HTTP error, or a bad payload.
- A joined speaking usage row and attempt log. The stored correlation does not match.

### Privacy

Failure logs outside teaching do not include prompts, model JSON, or student text. Project logs a fixed error code. Speech tests reject payloads that contain the key and still return the generic message. Speaking stores the transcript on the attempt before evaluation. That row is product data. A diagnostic line must not copy it.

The follow-up risk is logging a Zod message or a rejected value. Teaching already keeps only a sanitized path and issue code through `sanitizeSchemaIssues`. A later change should reuse that filter.

### Ranked follow-ups

1. Log the fields the adapter already sets for code review, interview, and speaking evaluation. Add `failureCategory` and `httpStatus` to the project failure line, which already has `code`. Print sanitized schema issues only when the error already carries them. Keep the public 503. This is a small helper and four catch sites. It separates timeout, authentication, rate limit, availability, provider HTTP, empty content, and malformed JSON without a second taxonomy.
2. Store the attempt correlation on speaking usage instead of `"speaking"`. Small, and it does not add transcript text to the log.
3. After those logs exist, distinguish local rejections from adapter failures. `parseCodeReviewResult` can attach sanitized Zod issues the way `parseTeacherResult` does. Project review uses that parser. Interview, speaking, and project plan need a category on the existing throws, such as schema versus leak versus safety, without the rejected text. Do not recover invalid fields. This is larger than logging and touches acceptance behavior only if a throw is mis-tagged.
4. Give speech its own status token for timeout, HTTP failure, and unreadable content, and print that token in `speakingLogLine`. Do not log audio or transcript text. This is separate from chat recovery and matters only when transcription fails.

Do not add timing spans to every module. Duration is already logged, and provider latency is not required to name the failure. Do not enable `review`, `classify`, or `summarize`. Do not extend `suggestedState` recovery.

## Cross-Module Provider Diagnostic Propagation

Date: 10 October 2026. Internal logs only. Public HTTP statuses and error bodies are unchanged. Prompts, schemas, normalizers, safety rules, recovery, provider settings, scoring, and the speaking usage correlation were not changed.

`describeAiFailure` in `apps/api/src/modules/ai/ai-failure-log.ts` reads an existing error. For `AIProviderError` the category is `failureCategory` when set, otherwise `code`. HTTP status is kept when it is an integer from 100 through 599. Sanitized schema issues already on the error are copied as `path:code`. `AiConfigurationError` logs `configuration`. `AiTaskUnavailableError` logs `task_unavailable`. Anything else logs `unknown`. The suffix does not read the error message.

Code review, interview, and speaking evaluation append that suffix to the failure line they already wrote. Project plan and milestone review keep `code` and add the same suffix. Speaking adds it only on `ai-unavailable`. Other speaking statuses stay on the old line. No module gained teaching timing spans.

A provider 4xx now logs `category=provider_http_error` and `http_status=400`. Empty content logs `empty_provider_response`. Malformed JSON logs `malformed_json`. A timeout or HTTP 429 logs the provider code, and 429 also logs `http_status=429`. A module throw of bare `invalid_response` logs `category=invalid_response` and `http_status=null`, with no schema issues. That separates adapter failures from local validation. It does not separate a schema miss from a leak, a full solution, or a hand-written type check, because those throws still carry no category and no issue path.

### Privacy

The line contains the existing correlation id, operation name, category, HTTP status, duration, and schema issue tokens only when the error already had them. It does not contain prompts, response bodies, student answers, transcripts, keys, or rejected values. Tests plant those strings in the request or model payload and assert they stay out of the line.

### Verification

Focused API tests, including teaching HTTP and teach timing: 7 files, 51 passed.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 18 cache hits. Fresh API build `0724b1b51a7933e0` and fresh API tests, 123 passed. Cached tests: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, AI 85, web 75. Total 509 passed.

`pnpm lint`: 11 tasks, API lint fresh `4a8e08506c151968`, 10 cached.

`pnpm typecheck`: 22 tasks, API typecheck fresh `70fb9a1498a22aa2`, 21 cached.

`NODE_ENV=production pnpm build`: 11 tasks, all cache hits. The API compile replayed the fresh test build. Web compile hash `55a98feec9163e92` is unchanged.

### Remaining gaps

Local schema, leak, and safety rejections outside teaching still share `invalid_response` with no field path. Speech timeout, HTTP failure, and unreadable transcription JSON still share `SPEECH_UNAVAILABLE`. Speaking usage still stores the correlation `speaking`. Those were left for a later step.

## Module-Level AI Failure Classification

Date: 10 October 2026. The public code stays `invalid_response`. The internal category is now set when the throw site knows the cause. Adapter errors are not rewritten: a provider HTTP error, timeout, rate limit, empty response, or malformed JSON still keeps the category and HTTP status from Step 45.8. Teaching recovery and `teach_timing` were not changed.

Two categories were added to the existing list: `schema_rejection` and `full_solution_rejection`. Leak and hidden-literal checks reuse `internal_leak_rejection`. `teacher_schema_rejection` stays on the teaching parser only.

| Module                   | Schema                                                                                                                                                                   | Leak or hidden literal                                          | Full solution                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| Code review              | `parseCodeReviewResult` attaches Zod path and code. A summary or feedback that cleans to empty uses path `summary` or `feedback` and code `too_small`                    | `assertNoLeak`, plus summary, feedback, hint, and next question | None. Project review checks this first                 |
| Project milestone review | Falls through to the code-review parser                                                                                                                                  | Falls through to the code-review leak check                     | `containsFullSolution`                                 |
| Project plan             | Non-object input, a missing summary, or a list that is not an array. Summary issues name `summary`. List issues name `strengths`, `risks`, `suggestions`, or `questions` | `postgresql://`, `DATABASE_URL`, `sk-`, or a forbidden literal  | `<!DOCTYPE`, `</html>`, or `function greet`            |
| Interview                | Shape, enum, and required-text checks. The path is the field that failed, such as `understanding` or `evaluation.reasoningQuality`                                       | Leak pattern or a forbidden literal                             | `return n % 2 === 0` when the student did not write it |
| Speaking evaluation      | Same shape and required-text checks. List items that are not strings are still dropped, not rejected                                                                     | Leak pattern or a forbidden literal                             | Same solution pattern when it is not in the transcript |

HTTP status stays null. The log still uses the existing correlation id and duration. Schema issues are included only for these known paths and codes. A bare `AIProviderError("invalid_response")` with no category still logs `invalid_response`.

Code-review strengths and issues that contain a leak or a hidden literal are still removed from the accepted review rather than rejected. That path does not emit a category. Speech transcription is unchanged. Speaking usage still stores the correlation `speaking`.

### Verification

Focused AI tests: 8 files, 45 passed, including teacher schema and teacher normalization. Focused API tests, after rebuilding `@platform/ai`: 7 files, 51 passed, including teaching HTTP and teach timing.

The first `EXECUTION_MODE=fake pnpm test --concurrency=1` compiled and passed AI tests fresh (`d6292d88e665088c`, 86 tests) and then failed in the API suite because local registration returned 429. Those rows were cleared and the suite was run again. The rerun passed: 20 tasks, 19 cache hits, fresh API tests, 123 passed. Cached counts on that rerun included AI 86. Total 510 passed.

`pnpm lint`: 11 tasks. Fresh AI lint `88e235f069f1b765` and API lint `21f3ec4fa3e9bf64`. 9 cached.

`pnpm typecheck`: 22 tasks. Fresh AI typecheck `98a725976edf3ffb` and API typecheck `5199dfe365fa04ac`. 20 cached.

`NODE_ENV=production pnpm build`: 11 tasks, all cache hits. `NODE_ENV=production pnpm exec turbo build --force` then bypassed the cache and executed all 11 builds, including AI `d6292d88e665088c` and API `452ef7f235b4d09e`. The web hash stayed `55a98feec9163e92` and Next compiled again in that forced run.

## Speech Failure Diagnostics

Date: 11 October 2026. Internal logs only. The public speech response stays 503 `SPEECH_UNAVAILABLE` with the same message and body. Transcription text, persistence, evaluation, scoring, prompts, request parameters, retries, the 20 second timeout, teaching recovery, and the speaking usage correlation were not changed.

`HttpSpeechToTextProvider` now sets a category on `SpeechUnavailableError` at the throw that can already tell the cause. The public `code` stays `SPEECH_UNAVAILABLE`. The speaking service keeps that error and appends the existing failure suffix to `status=speech-unavailable`. The line still has the attempt correlation id and `durationMs`. HTTP status is logged only when the response has one. The suffix does not read the error message.

| Failure                  | Evidence at the throw                                                                   | Category                                      | HTTP status                    |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------ |
| Abort                    | `fetch` throws `TimeoutError` or `AbortError` from `AbortSignal.timeout`                | `timeout`                                     | null                           |
| Other fetch failure      | `fetch` throws anything else                                                            | `unavailable`                                 | null                           |
| Authentication           | Status 401 or 403. The error body is not read                                           | `authentication`                              | that status                    |
| Rate limit               | Status 429. The error body is not read                                                  | `rate_limit`                                  | that status                    |
| Server error             | Status 500–599, including a non-JSON body                                               | `unavailable`                                 | that status                    |
| Other HTTP client error  | Status 400–499, including 408. 408 stays an HTTP failure so it is not labeled `timeout` | `provider_http_error`                         | that status                    |
| Unrecognized status      | For example 302                                                                         | `unknown`                                     | that status when it is 100–599 |
| Empty success body       | Status is OK and `response.text()` trims to empty, before `JSON.parse`                  | `empty_provider_response`                     | null                           |
| Unreadable JSON          | Status is OK, the body is non-empty, and `JSON.parse` throws                            | `malformed_json`                              | null                           |
| Missing transcript field | JSON parsed, and `text` is missing or not a string                                      | `schema_rejection`, issue `text:invalid_type` | null                           |
| No category              | Disabled provider, the fake unavailable path, or `new SpeechUnavailableError()`         | `unknown`                                     | null                           |

A body read that itself throws is `unavailable`, because the bytes were never available to call JSON. An empty string in `text` is still accepted. HTTP error bodies are not inspected, so a safety refusal inside an error body stays with the status category. The log does not contain audio, the transcript, the response body, or the provider key.

### Verification

Focused speech tests: 1 file, 6 passed. Focused API tests, after rebuilding `@platform/ai`: 4 files, 26 passed, including speaking HTTP, teaching HTTP, and teach timing.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 16 cache hits. Fresh AI build `8268667f25812fe6` and fresh AI tests `dee0f5a510d9ba0f`, 88 passed. Fresh API build `6fcefc261005fe73` and fresh API tests `7871798fd4732f62`, 125 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, web 75. Total 514 passed.

`pnpm lint`: 11 tasks. Fresh AI lint `47e4d3e5ee9e0a49` and API lint `e933ad6596d8783c`. 9 cached.

`pnpm typecheck`: 22 tasks. Fresh AI typecheck `f95d90dbbb34e632` and API typecheck `8354c1350352ff88`. 20 cached. The AI and API builds replayed the fresh test builds. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. AI `8268667f25812fe6` and API `6fcefc261005fe73` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again in that run (7.6 minutes compile, 4.8 minutes typecheck) and the task succeeded. Time 42m35s.

### Remaining gaps

A safety phrase in a speech HTTP error body is not a separate category. Speaking usage still stores the correlation `speaking`. Code-review strengths and issues that contain a leak or a hidden literal are still dropped from the accepted review. Teaching recovery was not extended.

## Speaking Usage Correlation

Date: 11 October 2026. The usage row and the speaking log for one request now share one correlation id. Public HTTP bodies, speech categories, scoring, and token accounting are unchanged. No schema change was required: `ai_usage.correlation_id` and `transcription_usage.correlation_id` are already strings.

`answer` creates the authoritative id with `randomUUID()` after the request is accepted. That id is not the client attempt id and not the database attempt id. It was already written on the diagnostic line and on transcription usage. `recordAiUsage` still received the fixed values `speaking` for a provider evaluation and `scripted` for the development fallback. `finishAttempt` then stored the request id, so the usage object and the row could disagree.

`evaluate` now receives that request id and puts it on the usage object for both the provider path and the development scripted path. `finishAttempt` persists `evaluated.usage.correlationId`. An empty or missing id still falls back to `speaking` or `scripted` and does not create a new id. A speech failure writes no usage row. An evaluation failure after a successful transcription keeps the id on the transcription row and on the `ai-unavailable` line, and does not write an `ai_usage` row.

A later retry of the same stored attempt creates a new request id for that evaluation and its log. The original transcription row keeps the first request id. Joining those two rows would require storing the first id on the attempt, which the current table does not do.

### Verification

Focused tests: 2 files, 11 passed. That includes the correlation fallback and the speaking HTTP success, evaluation-failure, and speech-failure paths.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 18 cache hits. Fresh API build `c0301838787012aa` and fresh API tests `813e9bca2ee95565`, 128 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, AI 88, web 75. Total 517 passed.

`pnpm lint`: 11 tasks. Fresh API lint `377e052361ead8cc`. 10 cached.

`pnpm typecheck`: 22 tasks. Fresh API typecheck `c991e14f55f5ca5f`. 21 cached. The API build replayed `c0301838787012aa`. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. API `c0301838787012aa` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again (8.3 seconds compile, 7.4 seconds typecheck). Time 44.977s.

### Remaining gaps

A resumed evaluation does not reuse the transcription correlation from the first request. A safety phrase in a speech HTTP error body is still not a separate category. Code-review strengths and issues that contain a leak or a hidden literal are still dropped from the accepted review. Teaching recovery was not extended.

## Code Review Partial Safety-Drop Diagnostics

Date: 11 October 2026. Observability only. A strength or issue that is removed for a safety reason the normalizer can prove now produces structured internal metadata. The accepted review, scoring, ordering, prompts, schemas, provider requests, and the public HTTP contract are unchanged. A partial drop stays a successful review. It does not become a whole-review failure.

`normalizeCodeReviewTurn` returns the same `CodeReviewResult` as before, plus `safetyDrops`. `normalizeCodeReviewOutput` still returns only the result, so project milestone review keeps its previous call and does not receive the metadata. The exercise review service logs the drops on the existing completed line, after `durationMs`, with the existing correlation id. When nothing was dropped for a safety reason, the line is unchanged: `review correlation=${id} mode=${mode} status=completed durationMs=${n}`.

Each entry is `{ path, category, count }`. `path` is `strengths` or `issues`. Counts are integers. The suffix is ` safety_drops=` followed by `path:category:count` pairs, joined by commas, and only for counts above zero. Stable order is strengths leak, strengths hidden literal, issues leak, issues hidden literal.

| Drop                                                                                            | How it is identified                                                             | Category                  |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| Strength or issue description matches the existing internal-leak pattern after HTML is stripped | `INTERNAL_LEAK` is tested first                                                  | `internal_leak_rejection` |
| The cleaned text contains a non-empty forbidden literal, and it did not match the leak pattern  | `scope.forbiddenLiterals`, the same list already used for hidden expected values | `hidden_literal`          |

A string that matches both checks is counted once, as `internal_leak_rejection`. `hidden_literal` is a diagnostic token for this list filter. It is not a new public error code and it is not added to the module failure taxonomy. Summary, feedback, hint, and next question that fail either check still throw `internal_leak_rejection` for the whole review.

These removals are not safety drops and stay unlabeled: text that is empty after HTML is stripped; items removed by the existing cap of three before the filter runs; non-style issues removed because the attempt passed; an unknown concept slug stripped from an issue that is otherwise kept; schema failures.

A raw leak that matches before HTML is stripped still fails the whole review through `assertNoLeak`. That path already logs `internal_leak_rejection` on the unavailable line. It is not converted into a partial drop.

The log contains the path, the category, and the count. It does not contain the rejected text, student code, explanations, prompts, credentials, or raw provider output. The stored review and the HTTP body are the filtered result only.

### Verification

Focused AI tests: 2 files, 22 passed, including code-review normalization and project review. An earlier assertion expected a fourth issue to be counted; that item is removed by the existing three-item cap before the safety filter, and the assertion was corrected to that behavior. Focused API tests, after rebuilding `@platform/ai`: teaching HTTP, teach timing, speaking HTTP, speaking correlation, and AI failure-log tests passed (5 files, 29 tests). The code-review HTTP file was rerun with `EXECUTION_MODE=fake` and passed (1 file, 8 tests). The first attempt of that file returned 503 on attempt creation because fake execution was not set.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 16 cache hits. Fresh AI build `37be92d368dc9b0b` and fresh AI tests `4152e20d014ec3e0`, 91 passed. Fresh API build `ee9061281caf93cb` and fresh API tests `6ba54adecb299212`, 129 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, web 75. Total 521 passed.

`pnpm lint`: 11 tasks. Fresh AI lint `0977b775f7a2e633` and API lint `82247e678835cf73`. 9 cached.

`pnpm typecheck`: 22 tasks. Fresh AI typecheck `5e9eed1e7bc1fc0a` and API typecheck `61525de4613a7641`. 20 cached. The AI and API builds replayed the fresh test builds. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. AI `37be92d368dc9b0b` and API `ee9061281caf93cb` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again (5.4 seconds compile, 18.4 seconds typecheck). Time 51.744s.

### Remaining gaps

Project milestone review shares the filter and discards the drop metadata, so those drops are not logged. Items removed by the three-item cap are not counted, even if they would have matched. A raw leak still fails the whole review. A hidden literal in summary, feedback, hint, or next question still throws `internal_leak_rejection`. A safety phrase in a speech HTTP error body is still not a separate category. A resumed speaking evaluation still does not reuse the first transcription correlation. Teaching recovery was not extended.

## Project Milestone Review Safety-Drop Diagnostics

Date: 11 October 2026. The project milestone review path now keeps the safety-drop metadata that code review already produces. Accepted review output, filtering, scoring, prompts, schemas, and the public HTTP contract are unchanged. A partial drop stays a completed review.

`normalizeProjectReviewOutput` still returns only the `CodeReviewResult`. It now does that by calling `normalizeProjectReviewTurn`, which runs the existing full-solution check and then `normalizeCodeReviewTurn`. The milestone review service logs `normalized.safetyDrops` on the existing completed line, after `durationMs`, with the same correlation id. The suffix is the code-review format: ` safety_drops=path:category:count`, only for counts above zero, in the same order. When there are no proven drops, the line stays `project review correlation=${id} mode=${mode} status=completed durationMs=${n}`.

Categories are the ones the code-review filter already assigns. `internal_leak_rejection` is a cleaned strength or issue that matches `INTERNAL_LEAK`. `hidden_literal` is a cleaned strength or issue that contains a non-empty forbidden literal from `projectHiddenLiterals` and did not match the leak pattern. A string that matches both is counted once, as `internal_leak_rejection`. Empty text, the three-item cap, passed-attempt style filtering, and schema failures stay unlabeled.

Project plan review was not changed. It uses `normalizeProjectPlanReview`, a different result shape, and a leak or forbidden literal there still rejects the whole plan. Summary, feedback, hint, and next question on a milestone review still throw for the whole review. A raw leak that matches before HTML is stripped still fails the milestone review through `assertNoLeak`.

The completed line contains the path, the category, and the count. It does not contain the rejected text, project files, student code, prompts, credentials, or raw provider output. The stored `project_review.result` and the HTTP body are the filtered review.

### Verification

Focused AI tests: 2 files, 24 passed, including project-review normalization and code-review normalization. Focused project HTTP tests, after rebuilding `@platform/ai` and with `EXECUTION_MODE=fake`: 1 file, 12 passed. That includes the greeting milestone drop log, the unchanged completed line when there are no drops, and the existing success and failure contracts.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 16 cache hits. Fresh AI build `9e934092c5e291da` and fresh AI tests `21add6c5a4c125f4`, 93 passed. Fresh API build `2bb8953fb00fcab0` and fresh API tests `867abb27b39187b4`, 130 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, web 75. Total 524 passed.

`pnpm lint`: 11 tasks. Fresh AI lint `867117c70147d3e2` and API lint `e2e10f33b16c5723`. 9 cached.

`pnpm typecheck`: 22 tasks. Fresh AI typecheck `20adee7f768f9c97` and API typecheck `22b645fc31fe0929`. 20 cached. The AI and API builds replayed the fresh test builds. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. AI `9e934092c5e291da` and API `2bb8953fb00fcab0` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again (2.4 seconds compile, 4.7 seconds typecheck). Time 30.523s.

### Remaining gaps

Project plan review still rejects a leak or hidden literal for the whole plan, so it has no partial-drop count. Items removed by the three-item cap are not counted. A raw leak still fails the whole milestone review. A hidden literal in summary, feedback, hint, or next question still throws `internal_leak_rejection`. A safety phrase in a speech HTTP error body is still not a separate category. A resumed speaking evaluation still does not reuse the first transcription correlation. Teaching recovery was not extended.

## Speaking Retry Correlation Continuity

Date: 11 October 2026. A speaking usage row can now be joined to the speaking attempt that caused it. Each request still has its own correlation id. Public HTTP bodies, token counts, cost, transcription text, evaluation, and scoring are unchanged.

The request correlation id is the UUID created at the start of `answer`. It is written on the diagnostic line and on `correlation_id`. A retry creates a new one. The logical join key is `speaking_attempts.id`, which `beginAttempt` creates once and returns again when a transcribed attempt is resumed. That id is not the client attempt id and not the request correlation id.

`ai_usage.speaking_attempt_id` and `transcription_usage.speaking_attempt_id` store that attempt id. Migration `20261011120000_speaking_attempt_usage` adds both columns as nullable UUIDs and indexes them. It does not add a foreign key and does not backfill existing rows. A row written before this change, or by teaching, review, interview, or project usage, stays null. New speaking writes set the column once. Later requests do not update it.

A resumed evaluation inserts a new `ai_usage` row with the same attempt id and the new request correlation id. The original transcription row keeps the first request correlation id and the same attempt id. `finishAttempt` writes usage only while the attempt is `pending` or `transcribed`. A second finisher finds the attempt already completed and does not insert another usage row or change the first attempt id. Two attempts keep different attempt ids. A speech failure still writes no usage row and deletes the pending attempt. An evaluation failure writes the transcription row with the attempt id and writes no `ai_usage` row.

The diagnostic line still contains only the request correlation id. It does not contain the transcript, audio, or the attempt id.

### Verification

`prisma validate` passed. `prisma migrate deploy` applied `20261011120000_speaking_attempt_usage`. `prisma migrate status` then reported the schema up to date, 15 migrations.

Focused tests: speaking HTTP and speaking log, 2 files, 12 passed. Database package tests, 7 files, 11 passed.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 16 cache hits. Fresh database build `a40cda8b0e0184a0` and fresh database tests `48847fa5589e3710`, 11 passed. Fresh API build `031bb534b8763fc6` and fresh API tests `578dc7a4baf01c21`, 131 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, AI build `9e934092c5e291da`, AI tests `21add6c5a4c125f4` with 93 passed, web 75. Total 525 passed.

`pnpm lint`: 11 tasks. Fresh database lint `a944192ef0c4c2ea` and API lint `4db11d0d778046c1`. 9 cached. AI lint replayed `867117c70147d3e2`.

`pnpm typecheck`: 22 tasks. Fresh database typecheck `ca18b5eb92807eb8` and API typecheck `83f7de8859cb963b`. 20 cached. The database build replayed `a40cda8b0e0184a0` and the API build replayed `031bb534b8763fc6`. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. Database `a40cda8b0e0184a0` ran `prisma generate` and `tsc`. API `031bb534b8763fc6` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again (2.2 seconds compile, 5.3 seconds typecheck). Time 27.302s.

### Remaining gaps

Rows written before this column stay null. They are not assigned an attempt id. The column is not a foreign key, so deleting an attempt does not clear or rewrite the stored id. The diagnostic line still shows the request correlation id and not the attempt id. A safety phrase in a speech HTTP error body is still not a separate category. Teaching recovery was not extended.

## Speaking Attempt ID in Diagnostic Logs

Date: 11 October 2026. Speaking diagnostic lines that already have a repository attempt id now include it beside the request correlation id. No schema change. Public HTTP bodies, token accounting, and usage persistence are unchanged.

`speakingLogLine` writes `speaking correlation=${requestId} speaking_attempt_id=${attemptId} status=${status} durationMs=${n}`. The request id is the UUID created for that `answer`. The attempt id is `speaking_attempts.id` returned by `beginAttempt`, including a resumed transcribed attempt. The two values stay in different fields. An empty or missing attempt id is omitted. The function does not invent one, and it does not use the client attempt id.

These lines include the attempt id: `unclear`, `completed`, `scripted`, `speech-unavailable`, and `ai-unavailable`. Each of those runs after `claim` has returned `ready` or `resume`. A closed session, a missing session, a rate limit, or a busy wait throws before that return, so no speaking diagnostic line is written. A speech failure logs the attempt id and then deletes the pending attempt. That path still writes no usage row. An evaluation failure logs the same attempt id that is stored on the transcription row.

The line does not contain the transcript, audio, answer text, prompt, or provider output.

### Verification

Focused speaking log and HTTP tests: 2 files, 14 passed.

`EXECUTION_MODE=fake pnpm test --concurrency=1`: 20 tasks, 18 cache hits. Fresh API build `5124a61d93c0682f` and fresh API tests `51c1d79e98d09dc7`, 133 passed. Cached counts: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, AI build `9e934092c5e291da`, AI tests `21add6c5a4c125f4` with 93 passed, web 75. Total 527 passed.

`pnpm lint`: 11 tasks. Fresh API lint `a3b900288d430efb`. 10 cached.

`pnpm typecheck`: 22 tasks. Fresh API typecheck `27345342c8e42cbf`. 21 cached. The API build replayed `5124a61d93c0682f`. The web build replayed hash `55a98feec9163e92` and was not a new compile.

`NODE_ENV=production pnpm exec turbo build --force`: 11 tasks, 0 cache hits, every task `cache bypass, force executing`. API `5124a61d93c0682f` ran `tsc`. The web hash stayed `55a98feec9163e92`. Next compiled again (1.9 seconds compile, 3.0 seconds typecheck). Time 22.74s.

### Remaining gaps

Usage rows written before `speaking_attempt_id` stay null. They are not backfilled. A speech-failure line names an attempt that is then deleted and has no usage row. The column is still not a foreign key. A safety phrase in a speech HTTP error body is still not a separate category. Teaching recovery was not extended.

## Final AI Diagnostics Audit and Prioritized Follow-ups

Date: 11 October 2026. Source and test inspection only. No application code was changed. No live provider call was made. The fake-mode suite and the forced production build were not run again for this section. Counts below are the results already recorded in the preceding sections, checked against the current files.

### Verified completed work

| Area                                                                                       | Evidence                                                                                                                                                                                                                                                                                                         | Status                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teaching `suggestedState` recovery                                                         | `packages/ai/src/schemas/teacher-result.ts` recovers only when every issue is `suggestedState` / `invalid_value`. `packages/ai/src/safety/normalize-teacher-result.ts` still runs the leak check after that parse. Tests: `teacher-result.spec.ts`, `normalize-teacher-result.spec.ts`, `teaching.http.spec.ts`. | Verified in code and tests. A 10 October live sample of 12 `gpt-4o-mini` turns recovered 7 and strictly accepted 5, all into the forced states. That sample did not exercise an unrelated schema or safety failure. |
| Provider failure categories on internal logs                                               | `apps/api/src/modules/ai/ai-failure-log.ts` writes `category` and `http_status` from `AIProviderError` and `SpeechUnavailableError`. Call sites: teaching timing, exercise review, project plan, project milestone review, interview, and speaking. Tests: `ai-failure-log.spec.ts` and the module HTTP specs.   | Verified in code and fake HTTP tests. Not sampled in production outside the 10 October teaching timing events.                                                                                                      |
| Module categories `schema_rejection`, `full_solution_rejection`, `internal_leak_rejection` | `packages/ai/src/provider/errors.ts`. Used by code review, project review, project plan, interview, and speaking normalizers. `teacher_schema_rejection` stays on the teaching parse.                                                                                                                            | Verified in code and unit tests. Public HTTP stays 503 `AI_UNAVAILABLE`. Interview text stays "The interviewer is temporarily unavailable."                                                                         |
| Speech classification                                                                      | `packages/ai/src/speech/http-speech.ts` sets timeout, unavailable, authentication, rate limit, provider HTTP error, unknown, empty body, malformed JSON, and missing `text`. Tests: `speech.spec.ts`, `speaking.http.spec.ts`. Public body stays 503 `SPEECH_UNAVAILABLE`.                                       | Verified in code and fake tests. Not confirmed against a live speech provider in this audit.                                                                                                                        |
| Speaking attempt join and distinct request ids                                             | `speaking_attempts.id` is stored on new usage rows by `speaking-repository.ts` and `speaking.service.ts`. Migration `20261011120000_speaking_attempt_usage` adds nullable columns and no backfill. Each `answer` still creates its own request UUID. Tests: `speaking.http.spec.ts`, `speaking-log.spec.ts`.     | Verified in code, migration SQL, and fake HTTP tests. Not confirmed against production rows.                                                                                                                        |
| Speaking logs carry both ids when the attempt exists                                       | `speaking-log.ts` appends `speaking_attempt_id` for `unclear`, `completed`, `scripted`, `speech-unavailable`, and `ai-unavailable`. A missing id is omitted.                                                                                                                                                     | Verified in code and tests.                                                                                                                                                                                         |
| Code-review and milestone-review partial safety drops                                      | `normalize-code-review.ts` counts cleaned leak and hidden-literal drops on `strengths` and `issues`. `exercise.service.ts` and `project.service.ts` append `safety_drops=` only when a count is positive. Tests: `review.spec.ts` in both prompt packages, plus the exercise and project HTTP specs.             | Verified in code and fake tests. Not confirmed from production logs.                                                                                                                                                |
| Public error contracts                                                                     | Exercise, project, teaching, and speaking failures assert 503 `AI_UNAVAILABLE` or `SPEECH_UNAVAILABLE` with the existing messages.                                                                                                                                                                               | Verified by the HTTP specs. This audit did not call a deployed API.                                                                                                                                                 |
| Latest recorded local verification                                                         | Step 45.15 recorded `EXECUTION_MODE=fake pnpm test --concurrency=1` at 527 passed, and a forced build of 11 tasks with 0 cache hits in 22.74s.                                                                                                                                                                   | Recorded, not re-run here.                                                                                                                                                                                          |

### Remaining gaps

1. Historical `speaking_attempt_id` values are null. The migration has no `UPDATE`. Old usage rows cannot be joined to an attempt. This is a data-history limitation. Inventing ids would be worse than leaving them null. No production count of those rows was taken.

2. `speaking_attempt_id` is not a foreign key. A deleted attempt can leave the UUID on a usage row. That preserves the id the log already printed. A `SET NULL` foreign key would erase it. A cascade would delete usage rows. The current column is an intentional loose reference.

3. A speech failure logs `speaking_attempt_id` and then `releaseAttempt` deletes the pending attempt. No transcription or `ai_usage` row is written. The line is still the record of that request. Keeping the attempt would change the lifecycle the tests lock.

4. `speechHttpFailure` uses only the HTTP status. The error body is not read. A safety phrase in that body stays in the status category. Reading the body could copy audio-provider text into a path that must stay free of transcripts and keys.

5. `normalizeProjectPlanReview` rejects a leak, a forbidden literal, or a full solution for the whole plan. It does not emit partial-drop counts. The plan result is one text object, and a leaked field fails the review closed. Splitting it into accepted and dropped items would change what is stored.

6. `capReview` keeps three strengths and three issues before the safety filter. Items past that cap are not safety-drop counts. They were not classified. Counting them would label text the filter never accepted or rejected.

7. `assertNoLeak` rejects the whole code or milestone review when a raw leak matches before HTML is stripped. That is fail-closed. The partial-drop path is only the post-clean filter. Turning a raw leak into a partial accept would keep the rest of a response that already matched the leak pattern.

8. A hidden literal in summary, feedback, hint, or next question throws `internal_leak_rejection` for the whole review. The log does not say `hidden_literal`. The public result is still a rejection, which is the safe outcome. The missing detail is category precision.

9. Teaching recovery stays on one condition: every schema issue is `suggestedState` / `invalid_value`, and the leak check still runs afterward. The 10 October sample showed that path accepting legal states. Widening it could commit a turn with a different schema or safety failure.

10. Additional inspection: the project-plan leak pattern is `postgresql://`, `DATABASE_URL`, and `sk-`. The code-review pattern also matches prompt-version and `AI_API_KEY` / `password_hash` strings. A plan that echoed only one of those extra markers would not take the plan leak branch. The plan is still truncated and returned only after the checks that do exist. Widening the pattern would increase whole-plan failures. No production example of that echo was found in the repository.

No inspected gap is an open privacy leak in the current logs. The logs store categories, counts, ids, and durations. They do not store rejected text, transcripts, prompts, or provider bodies. No P0 defect was found in the current source.

### Priority

| Priority | Gap                                                                                                | Impact                                                          | Recommended action                                                                       | Risk of changing it                                                            | Verification needed                                                              | Decision        |
| -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------- |
| P2       | No failure distribution after 10 October                                                           | Further code changes would be guessed                           | Read existing logs for `category=`, `safety_drops=`, and `teacher_schema_rejection` only | A query that selects transcripts or raw responses would expose student content | Hand review of sanitized counts, with no response bodies                         | fix next        |
| P2       | Hidden literal in summary, feedback, hint, or next question is logged as `internal_leak_rejection` | Operators cannot separate a hidden answer from an internal leak | Defer a log-only category split                                                          | A wrong split could hide a real leak or change the 503                         | Normalizer test plus the existing HTTP 503 contract                              | defer           |
| P3       | Null historical `speaking_attempt_id`                                                              | Old speaking usage cannot be joined                             | Leave null                                                                               | A backfill can attach the wrong attempt                                        | A count of null rows, only if history is required                                | leave unchanged |
| P3       | No foreign key on `speaking_attempt_id`                                                            | A deleted attempt id can remain on a usage row                  | Leave the loose reference                                                                | `SET NULL` deletes the join; cascade deletes usage                             | Schema review already done                                                       | leave unchanged |
| P3       | Speech-failure log names a deleted attempt                                                         | That line has no usage row                                      | Leave the log and the delete                                                             | Persisting the attempt changes the speech-failure contract                     | Existing speaking HTTP test                                                      | leave unchanged |
| P3       | Speech HTTP error bodies are not classified further                                                | Status categories stay coarse                                   | Leave the body unread                                                                    | The body can contain provider text or secrets                                  | Code inspection of `http-speech.ts`                                              | leave unchanged |
| P3       | Project plan fails closed instead of partial counts                                                | A leaked plan item fails the whole plan                         | Leave the whole-plan rejection                                                           | Partial acceptance can store unsafe plan text                                  | Existing plan HTTP 503 tests                                                     | leave unchanged |
| P3       | Three-item cap is not a safety-drop count                                                          | Extra items are invisible in `safety_drops`                     | Leave the cap ahead of the filter                                                        | Counting uncapped text mislabels a length limit as a leak                      | Existing cap assertion in `review.spec.ts`                                       | leave unchanged |
| P3       | A raw leak rejects the whole review                                                                | One raw match fails the review                                  | Leave fail-closed                                                                        | A partial accept can keep a response that already matched the leak pattern     | Raw-leak test in `review.spec.ts`                                                | leave unchanged |
| P3       | Project-plan leak pattern is narrower than code review                                             | Some internal markers are not a plan leak                       | Leave unless a real echo appears                                                         | A wider pattern increases whole-plan 503s                                      | A sanitized count of plan `internal_leak_rejection`, not a fixture invented here | leave unchanged |
| P3       | Teaching recovery is limited to one schema miss                                                    | Other schema errors still return 503                            | Leave the current gate                                                                   | A wider gate can commit a bad turn                                             | The 10 October sample plus `teacher-result.spec.ts`                              | leave unchanged |

### Next step

Do not change filtering, recovery, schema, or foreign keys next. The single next step is a read-only sanitized count of the categories these logs already emit: `category=`, `http_status=`, `safety_drops=`, and teaching `teacher_schema_rejection`. The count must not select transcripts, prompts, student answers, or raw provider output. That distribution decides whether the deferred hidden-literal label is worth a log-only change. Every other row above is already fail-closed or would weaken a safeguard.

### Evidence limits

Automated tests and the current source establish the behavior in this section. The only live provider evidence in the audit is the 10 October teaching samples. Speech, code review, project review, project plan, interview, and speaking were not rechecked against a live provider for this audit. No production database count of null `speaking_attempt_id` rows was taken. This section does not re-verify the 527-test run or the 22.74s forced build.

## Sanitized AI Failure Distribution — Step 45.17

Date: 12 October 2026, Asia/Baku. Read-only. No application code, schema, prompt, filter, recovery rule, or public contract was changed. No database rows were read or written. No live provider was called.

### Evidence source and access

The diagnostic fields this step needs are written to the API process log and are not stored.

| Source inspected                                    | What it holds                                                                                                                                                                                            | Access result                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/api/src/main.ts`                              | Nest `Logger` on process output. Bootstrap redacts a Postgres URL or bearer token from a start error.                                                                                                    | No retained log stream.                                                      |
| `apps/api/src/modules/ai/ai-failure-log.ts`         | `category=` and `http_status=` on failure lines.                                                                                                                                                         | Emitted only through that logger.                                            |
| `apps/api/src/modules/teaching/teach-timing.ts`     | `teach_timing` JSON with `outcome`, `error`, `http_status`, and `schema_issues` of path and code.                                                                                                        | Logged from `teaching.orchestrator.ts`. Not a table.                         |
| Exercise, project, interview, and speaking services | Completed and unavailable lines, including `safety_drops=` when a count is positive.                                                                                                                     | Same process log.                                                            |
| `packages/database/src/admin-analytics.ts`          | Admin failure rows. `AI` and `STT` are `unrecorded`: `recorded: false`, `count: null`. Payment and job rows are a different system.                                                                      | Cannot supply AI category counts.                                            |
| `ai_usage` and `transcription_usage`                | Successful usage: task, tokens, cost, latency, correlation id, and, for new speaking rows, attempt id.                                                                                                   | No failure `category`, `http_status`, or `safety_drops` column. Not queried. |
| `docs/architecture.md`                              | Names pino.                                                                                                                                                                                              | The API entrypoint does not use pino.                                        |
| `docs/release.md`                                   | Logs are partially verified. AI, speech, runner, and database failures stay log-only. No log drain was inspected. Monitoring is unverified. The checklist says no hosted production deploy was measured. | No authorized production log source in the repository.                       |

No logging vendor, log directory, or retained operational export was available. A local development database was not used as a substitute. Test output was not counted.

There is no time window of operational events. No total, module, `http_status`, `safety_drops`, duplicate, or missing-field count can be reported. Event counts and unique-request counts are both unavailable. A failure rate cannot be calculated because neither a failure numerator nor a matching denominator is stored.

### Privacy

No transcript, answer, prompt, raw model response, audio, credential, or request body was selected. The admin failure query was not run, because it cannot return the AI categories and its job grouping reads `lastError`. That field was left unread.

### What the three evidence classes say

**Production evidence.** None. The process log is not retained, and the admin overview records AI and speech failures as unrecorded.

**Historical evidence.** The 10 October teaching samples in this file, not a production distribution:

- Before recovery: 8 provider calls. 6 had `teacher_schema_rejection` with `suggestedState` / `invalid_value`. 2 were HTTP 200.
- After recovery: 12 provider calls. 7 recovered with that same issue and HTTP 200. 5 were strict accepts. 0 were rejected.

Those samples have no `safety_drops` field and no `hidden_literal` versus `internal_leak_rejection` split. They do not measure code review, project review, project plan, interview, speech, or speaking.

**Repository evidence.** Code and tests show that a hidden literal in summary, feedback, hint, or next question throws `internal_leak_rejection` for the whole review, and that a cleaned strength or issue can log `hidden_literal` as a partial drop. Tests prove the classification is possible. They do not prove how often either path occurs.

### Recommendation

Defer the log-only split between hidden-literal rejection and internal-leak rejection. The distinction cannot be measured, so a code change is not justified. Fail-closed review, the three-item cap, teaching recovery, public 503 responses, speaking foreign keys, and historical rows stay as they are.

### Next step

Do not implement that split. Do not add logging in order to create the missing counts. The justified next step is no application change. A later count is possible only if an existing log drain already stores `category`, `http_status`, `safety_drops`, and `teacher_schema_rejection` without transcripts, prompts, or raw provider output. Until that source exists, frequency is unknown and is not a reason to change the filters.
