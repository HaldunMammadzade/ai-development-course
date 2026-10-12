# Initial skill assessment

A new student is not dropped onto lesson 1 of the 63-lesson frontend path by default. After onboarding, the server opens a short adaptive check. The check only collects evidence. Placement, mastery, and which lesson is legal stay on the existing learning system.

This is not a second curriculum, a second mastery formula, or a second teaching state machine. There is no reassessment flow.

## Purpose

The check answers four questions from evidence, not from a self-report:

- which representative concepts the student can already answer
- which of those concepts are still weak
- which concepts were never asked, and therefore stay unknown
- which published lesson is the first legal place to start

The result is a starting point inside the current path. It is not a score such as “Intermediate, 73%”.

## User flow

```text
Register → verify email → onboarding → assessment → result → first legal lesson → dashboard
```

Onboarding is unchanged. It still creates the free plan, the frontend enrollment, and student preferences. The assessment is a separate server row, not a new preference or a new gate in `appGate`.

`GET /api/v1/assessment` decides the state:

| State          | When                                                                                                                          | What the student sees                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `in_progress`  | No assessment row and no other learning history. The first read creates the row.                                              | The current question at `/app/assessment`.                     |
| `completed`    | The server has placed the student.                                                                                            | The result, then the normal app.                               |
| `skipped`      | The student chose “Başlanğıcdan başla”.                                                                                       | Dashboard. No mastery is written. The path starts at lesson 1. |
| `not_required` | No assessment row, but lesson progress, a teaching session, an exercise attempt, or a non-quiz learning event already exists. | Dashboard. The check is not offered again.                     |

Routes under `/app` except `/app/assessment` sit in the `(study)` group. While the row is `in_progress`, that group redirects to `/app/assessment`. A completed, skipped, or not-required student is not redirected. Refreshing an open check reloads the same server question. The correct answer is not stored in the browser.

A student who already has learning history is never forced into the check. An in-progress row is not cancelled if history appears later.

## Assessment structure

One sitting asks at most 15 items. The bank has 17 items: 15 on the spine and two follow-ups (`request-again`, `function-again`). A follow-up is asked only after its spine item is missed. A missed spine item ends the sitting after its follow-up, when it has one. The server chooses the next item. The client sends the item id it was just shown, and the server rejects any other id.

Formats reuse `evaluateExercise`:

- `multiple_choice` for the MCQ items
- `code_text` with `contains_text` for the short answer and the function items

No new exercise engine and no second scorer.

## Concept coverage

Items are representative. They do not cover all 63 lessons.

| Item             | Concepts                                   | Kind           | Asked when                         |
| ---------------- | ------------------------------------------ | -------------- | ---------------------------------- |
| `request`        | `web.http`, `web.browser`                  | MCQ            | Always first                       |
| `request-again`  | `web.http`, `web.browser`                  | MCQ            | Only if `request` is missed        |
| `url`            | `web.url`                                  | MCQ            | Spine, after a pass                |
| `roles`          | `web.html`, `web.css`                      | MCQ            | Spine                              |
| `structure`      | `html.document`, `html.elements`           | Short (`main`) | Spine                              |
| `links`          | `html.links`, `html.attributes`            | MCQ            | Spine                              |
| `text`           | `html.text`                                | MCQ            | Spine                              |
| `semantic`       | `html.semantic`                            | MCQ            | Spine                              |
| `a11y`           | `html.a11y`                                | MCQ            | Spine. The prompt is a form label. |
| `selector`       | `css.selector`, `css.box-model`            | MCQ            | Spine                              |
| `flex`           | `css.display`, `css.flexbox`               | MCQ            | Spine                              |
| `responsive`     | `css.responsive`                           | MCQ            | Spine                              |
| `function`       | `js.function`                              | Code           | Spine                              |
| `function-again` | `js.function`                              | Code           | Only if `function` is missed       |
| `types`          | `ts.primitive`, `ts.interface`             | MCQ            | Spine                              |
| `react`          | `react.component`, `react.props`           | MCQ            | Spine                              |
| `next`           | `next.app-router`, `next.server-component` | MCQ            | Spine, last                        |

Areas named in the product brief that this bank does not ask — JavaScript variables, arrays, conditions, DOM, and async; TypeScript function typing, unions, and generics; React state, events, effects, and lists; Next.js routing and data fetching — stay `unknown`. They are not marked weak.

## Item selection

`selectAssessmentItem` is deterministic:

1. Stop at 15 answers.
2. If a missed item has an unasked follow-up, ask that follow-up.
3. If a missed spine item has no remaining follow-up, stop. Later domains are not asked.
4. Otherwise ask the next unasked spine item, and only if the previous spine item was passed.

The client cannot choose the branch.

## Scoring and evidence

`scoreAssessmentAnswer` calls `evaluateExercise`, then the existing lesson-check helpers:

- a pass is evidence 90 and weight `evidenceWeight("lesson_check", "correct")`
- a miss is evidence 20 and weight `evidenceWeight("lesson_check", "incorrect")`

On finish, each answered concept gets one `learning_events` row:

- `source` is the existing `quiz` value
- `metadata` is `{ context: "initial_skill_assessment", itemId }`
- the submission text is not copied into the event

`writeSkillMasteryProjection` rebuilds `skill_mastery` with `calculateMastery`. There is no assessment-only formula. Concepts that were not on an answered item get no event and no mastery row.

Unknown is not weak. Weak on the result page means score below 45 and at least two pieces of evidence, which is the existing band rule. One miss does not become a weak concept. The follow-up exists so a beginner who misses the first HTTP item gets a second HTTP item and can reach that band.

## Placement

After the events are written, `placeAssessment` walks published lessons in path order:

1. Skip a lesson that is already completed.
2. Stop on a lesson that is already in progress. That lesson is the start. Nothing is marked completed.
3. If every primary concept has score ≥ 60 (`UNLOCK_MASTERY`) and `isLessonUnlocked` is true, record that lesson to complete and continue.
4. If the lesson is unlocked but not fully known, that lesson is the start.
5. If the lesson is locked, discard every completion from this sitting and start at the first published lesson. A later correct answer never implies its prerequisites.

Completions are `lesson_progress` upserts with status `completed`. An existing `in_progress` row is not overwritten. `getNextAction` is not modified. It returns the first incomplete unlocked lesson, which is now the placement start. Catalog availability marks that lesson `current` and the completed prefix `completed`.

The result label is only a name for the starting module: Başlanğıc, Əsaslar, Orta səviyyə, or İrəli səviyyə. The decision itself is the lesson and the concept rows.

Saying “I know React”, or answering the React item correctly, does not unlock a React lesson while an earlier prerequisite is unknown. `web.javascript` is the primary of `js-basics` and is not on any item. A perfect sitting can record TypeScript, React, and Next.js evidence and still start at `js-basics`, because that lesson is not known and the lessons after it stay locked. Lessons 1–14 can be marked completed when their primaries were actually answered at ≥ 60.

Project eligibility still uses concept mastery ≥ 60. Evidence written here can make a project eligible. That is the existing rule, not a separate unlock.

## Security

The answer body is strict: `itemId`, `answer`, `clientAttemptId`. `score`, `placement`, `startLessonSlug`, and any other field fail validation and write nothing. The response item has `id`, `kind`, `prompt`, and option `id`/`label` only. Rules, the accepted answer, evidence, and mastery math are not returned.

A repeated `clientAttemptId` with the same item and answer is a replay. A repeated id with a different body is `ATTEMPT_REPLAY`. An item that is not the server’s current item is `ITEM_MISMATCH`. A closed or skipped assessment is `ASSESSMENT_CLOSED`.

No model is called. Provider failure cannot block the check. Prompts, model names, and token counts are not part of this flow.

## Failure handling

An empty or unknown item is `400 VALIDATION`. A network or server failure on the page uses the existing load error. A failed submit keeps the draft and shows the existing error copy. If the assessment API is down, the study layout does not trap the student in a redirect loop; the page load error remains on the assessment route itself.

Skip writes `skipped` and no mastery. It is the way out of the check. It is not a placement above lesson 1.

## Architecture

- Pure selection, scoring, and placement: `packages/curriculum/src/assessment.ts`
- Persistence and the mastery write: `packages/database/src/assessment-repository.ts`
- HTTP: `GET /api/v1/assessment`, `POST /api/v1/assessment/answers`, `POST /api/v1/assessment/skip`
- Web: `/app/assessment`, with the study routes gated by `apps/web/app/app/(study)/layout.tsx`

The page is a server component. The form is the only client island. There is no WebSocket, SSE, Redis, queue, embedding, or vector store. The finish transaction is bounded by the 15-item cap and one graph read.

## UI states

Question: title “Bilik səviyyəni müəyyən edək”, the lead, real progress such as `Sual 5 / 15`, the prompt, radios or a textarea, “Cavabı göndər”, and “Başlanğıcdan başla”. “Əvvəlki cavab” shows the student’s own last submission, as the option label when they chose one, and whether that part landed. It does not show the correct answer. There is no back step that changes an answer, because the branch has already been taken.

Result: “Sənin başlanğıc nöqtən”, the level name, the next lesson, concepts already known, gaps in words (“Bu mövzu hələ zəifdir.” or “Bu mövzuda boşluq var.”), and “Yoxlanmayan mövzular boşluq sayılmır.” The action is “Öyrənməyə başla” and links to the server’s lesson. The dashboard does not grow an assessment-score widget.

Loading uses the existing skeleton. Errors use the existing alert.

## Testing

Curriculum tests cover beginner, strong HTML/CSS, strong JavaScript, strong React, mixed, and insufficient evidence, including the `web.javascript` hole. HTTP tests cover an anonymous request, a new student, a returning student, validation, tampering, a mismatched item, attempt replay, beginner placement, and a perfect sitting whose catalog current lesson is `js-basics`. The screen test covers the question and the result markup without a percentage.

## Known limitations

- `web.javascript` is never assessed. Even a perfect sitting starts at `js-basics`. Later concepts can be known and still not open their lessons until the path reaches them. The personalized path shows that gap as the current step and does not treat the later known lessons as the next lesson. See `docs/product/personalized-learning-path.md`.
- The bank does not ask every topic in the product brief. Unasked concepts stay unknown.
- A perfect sitting can make HTML concepts eligible for a project, because project gates use mastery.
- Answers cannot be revised.
- Skip starts at lesson 1 and writes no evidence.
- Reassessment is not implemented.
