# Learning engine

The curriculum decides what exists and in what order. The session decides how the current lesson is taught. The model decides the words and proposes evidence. None of the three is allowed to do the others' jobs.

## Two clocks

**Macro.** Path → module → lesson, in `position` order. A published lesson unlocks when every prerequisite of its primary concepts has mastery of at least 60. This applies inside a module and across modules. Supporting concepts do not gate a lesson. A prerequisite gates the lesson only when that concept was primary on an earlier published lesson in the same path. Draft lessons do not count as taught. Unseen is not 60: a taught prerequisite with no mastery row stays locked, 59 stays locked, and 60 unlocks. In Phase 1 the graph is authored so this rule matches the published order. The student is not offered a later module to skip ahead.

**Micro.** Inside a lesson, the teaching state machine chooses explain, question, hint, adapt, or advance. This is the adaptive behavior students feel in Phase 1.

Phase 3 may insert a remedial lesson when a primary concept stays under 45 after the lesson that teaches it. Phase 1 surfaces that concept on the dashboard as a weak topic and lets Revision mode exist in the enum, without a separate remedial generator.

## Concept graph

Concepts are small and stable (`js.variables`, `js.functions`, `html.forms`). Lessons point at one or two primary concepts and any number of supporting ones.

Prerequisite edges are many-to-many. Cycles are rejected by the seed validator.

The dashboard skill map reads this graph. Phase 1 can show a simple grouped list with mastery percentages. The visual tree in the product spec is the same data, drawn properly in Phase 3. Mastery on a parent domain (JavaScript) is the mean of its concepts that have evidence, and is unlabeled when none do.

## Mastery

`learning_events` are facts. `skill_mastery` is a cache.

For a concept, take the latest 20 events:

```text
age_days = whole student-local calendar days since the event
decay    = exp(-age_days / 21)
score    = round(sum(evidence * weight * decay) / sum(weight * decay))
```

`age_days` uses the student's stored IANA timezone. Timestamps are `timestamptz` in UTC. The server's local clock is not the learning day. Phase 1 defaults are timezone `UTC` and locale `az-AZ`; both are user preferences and can change later.

The score uses only the latest 20 events. `evidence_count` is every persisted event for that concept, including events outside that window. `last_evidence_at` is the timestamp of the newest event. Zero events means there is no `skill_mastery` row. The score `0` is not stored as a stand-in for unseen.

Clamp the score to 0–100. The model proposes evidence only for lesson checks. The server first clamps that number to 0–100, then clamps it to the understanding band: correct 80–100, partial 45–75, incorrect 0–40. A value outside its band moves to the nearest boundary. The model cannot set the weight. Teaching turns write `lesson_check` and `homework`. An authored exercise writes `exercise` only after a passing deterministic score. At most three skill updates are stored per teaching turn, and a slug outside the current lesson's concepts and their direct prerequisites is discarded.

Default weights written by the server:

| Situation                       | Evidence                          | Weight |
| ------------------------------- | --------------------------------- | ------ |
| Check, understanding correct    | model evidence, clamped to 80–100 | 1.0    |
| Check, partial                  | clamped to 45–75                  | 1.0    |
| Check, incorrect                | clamped to 0–40                   | 1.2    |
| Homework done                   | server sets 80                    | 1.0    |
| Exercise passed on first submit | server sets 90 (Phase 2)          | 1.5    |
| Exercise passed after hints     | server sets 70 (Phase 2)          | 1.2    |
| Exercise failed                 | server sets 25 (Phase 2)          | 1.3    |

The Phase 2 rows above are not written yet. Step 10 uses the existing bands instead: a score of 80–100 stores that score as evidence with weight 1, a score of 70–79 stores evidence inside 45–75 with weight 1, and a score under 70 stores no event. The client does not send the evidence.

Bands:

| Score  | Meaning                                                                                     |
| ------ | ------------------------------------------------------------------------------------------- |
| no row | Unseen. Eligible to be taught. Not shown as a weakness.                                     |
| 0–44   | Weak only when `evidence_count >= 2`. One event under 45 is neither unseen nor weak.        |
| 45–59  | Fragile. The lesson may continue. A taught prerequisite at 59 keeps the next lesson locked. |
| 60–79  | Working. 60 is the unlock line.                                                             |
| 80–100 | Strong                                                                                      |

`evidence_count` is all persisted evidence events for that concept, not the latest-20 window and not the number of projection rebuilds.

Learning speed is not a score in Phase 1. `lesson_progress.time_spent_seconds` is stored so a later phase can compare duration with `estimated_minutes`. Showing a made-up speed number would mislead both the student and the teacher.

Confidence in the product spec maps to `evidence_count`: under 3 low, 3–7 medium, 8 or more high. It is a property of the estimate, not a feeling the model assigns.

## Misconceptions

A misconception has a stable `code`. The check-question traps in the lesson seed use the same codes. When the model reports a code from the current lesson's trap list, the server increments `occurrence_count`. When it reports a new code, the server accepts it only if `conceptSlug` is in scope and the description is within the length cap, and marks it `active`.

A later check with `understanding: correct` on that concept marks matching active misconceptions `resolved`. The teacher context loads active ones only.

Repeated mistakes are this table, not a scan of every past message.

## Session state machine

```text
created
  → prior_check
  → objective
  → explain            (socratic may skip after a correct prior_check)
  → comprehension_check
  → adapt              (if incorrect or partial)
  → comprehension_check
  → exercise           (Phase 1: the next check_question block, or recap if none remain)
  → evaluate
  → hint → evaluate    (at most twice)
  → raise_difficulty   (optional extra check; Phase 2: harder exercise)
  → summarize
  → homework
  → completed
```

Any open state can go to `abandoned` when the student exits or the session is idle for 12 hours.

Legal edges are one server-owned map. The model cannot invent a transition. `suggestedState` is applied only when that edge is legal for the current state, mode, understanding, and lesson context. A forced edge ignores every other suggestion. `completed` and `abandoned` are terminal.

The word "hint" in teacher speech is not the `hint` state. That state is only the explicit stage after `evaluate`.

Socratic: a correct `prior_check` may skip `explain` and go to `comprehension_check`. Any other understanding, including unknown, goes through `objective` and `explain`. Explain mode does not skip.

`exercise`: if an authored `check_question` remains, the next state is `evaluate`. If none remains, the server uses the recap `practicePrompt` and continues to `summarize`.

`raise_difficulty` is optional only after a successful evaluation when the lesson has an explicitly authored harder check. The default after success is `summarize`.

`completed` is entered only by the server, and only from `homework`, after the recap has been summarized and the homework row has been persisted.

Any open state can go to `abandoned` when the student exits or the session is idle for 12 hours. That exit is server-owned. It is not a model-invented jump from a forced edge.

Server-forced edges:

- After one turn in `explain`, the next request's state is `comprehension_check` even if the model wants to keep lecturing.
- After two `incorrect` evaluations on the same block, the next state is `adapt`, and the prompt is allowed to show a worked example. Then one new check is required.
- `hint` cannot run more than twice per block. The third failure moves to `adapt`.
- `completed` is set by the server when the recap block has been summarized and homework is stored, not by the model alone.

Phase 1 `exercise` and `evaluate` operate on authored `check_question` blocks. The same states point at code exercises in Phase 2 without renaming the machine. That is deliberate: the lesson flow in the spec (explain, check, adapt, exercise, hint, retry, summarize, homework) is this machine.

## Modes

| Mode      | Phase | Behavior                                                                                                                                            |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explain   | 1     | Short explanation, then a check. Default for a new lesson                                                                                           |
| Socratic  | 1     | Question first. Explanation only after a miss                                                                                                       |
| Practice  | 2     | Opens on `exercise` for the weakest in-scope concept that has an approved exercise                                                                  |
| Debug     | 2     | Student submits failing code. Hint ladder uses test names and the student's code. The final patch is withheld until two hints or an explicit reveal |
| Challenge | 2     | An exercise one difficulty above the student's band                                                                                                 |
| Revision  | 3     | Session whose lesson is synthetic: the three weakest concepts with evidence                                                                         |
| Project   | 3     | Mentor prompt and task reviews. Separate service, same memory and usage path                                                                        |
| Interview | 4     | Separate service and tables. Reads mastery to choose question depth                                                                                 |

The lesson screen offers Explain and Socratic in Phase 1. The others appear when their phase ships. The enum and the mode prompt registry exist so a new mode is a prompt plus a transition subset, not a new chat product.

## Next action

Phase 1 has exactly one active enrollment per user. The database can hold more than one enrollment row later, but `nextAction` reads only that single active enrollment. Registration will create the Frontend enrollment. Path switching is not part of Phase 1.

The dashboard and the lesson header share one function, `nextAction(user)`:

1. Homework due today or overdue in the student's timezone → "Finish homework."
2. Else an open teaching session on that enrollment → "Continue the lesson."
3. Else the first published lesson that is not completed and whose prerequisites are met → "Start lesson." A locked earlier lesson stops the walk. A later module is not offered as a way past it.
4. Else if any concept is weak (mastery row, score under 45, `evidence_count >= 2`) → "Review &lt;concept&gt;." The link is the earliest published lesson where that concept is primary.
5. Else the path is complete → "Path complete."

This function is deterministic and tested. The model is not asked what the student should do next.

## Homework

Entering `homework`, the server stores the model's homework string if it is non-empty. If the model returns nothing, the server uses the lesson recap `practicePrompt`. The recap block is `{ "points": ["..."], "practicePrompt": "..." }`. Homework is one short task, due in 24 hours. "Due today" uses the student-local calendar date, not the server's timezone.

The next teaching session context includes that prompt. A turn whose session state is already `homework` records accepted evidence with source `homework`. The assignment stays `assigned` when the lesson session reaches `completed`. Lesson progress stays `completed` while that homework is open. `nextAction` returns that homework when it is due today or overdue, and opening a session does not start another lesson.

The student completes homework with `POST /teaching/homework/:id/complete`. The server sets status `done`, writes one learning event per concept on that lesson with evidence 80 and weight 1.0, source `homework`, and `source_id` equal to the homework id, then rebuilds mastery and resolves active misconceptions on those concepts. Overdue homework can still be completed. A second completion returns the stored row and does not write another event. The model cannot set the status, the evidence, or the weight.

## Personalization the Phase 1 teacher actually does

- Explanation style and challenge level from `student_preferences`. Defaults are `clear` and `adaptive`. Locale defaults to `az-AZ` and timezone to `UTC`, both stored on the user.
- Active misconceptions, open homework, the session summary, and the current lesson's concepts with their direct prerequisites. Up to three memory notes are selected without embeddings: an in-scope mistake, then a preference, then an in-scope learning note. There is no goal category. Unrelated notes stay out of the packet.
- References an active misconception when one is in context.
- References open homework when present.
- After a partial answer, explains only the missing rubric point. The prompt receives the rubric and the student's answer for that purpose.
- Stops raising difficulty once the student has missed twice.

Personalization the Phase 1 teacher does not do:

- Invent a new syllabus.
- Change path order.
- Generate a brand-new coding exercise.
- Assign a numeric "confidence" or "learning speed."
- Infer a new explanation style from a single message. Style changes when the student sets it, or when they answer a direct preference question the settings page owns.

## Exercises, when they arrive

Selection in Phase 2, still deterministic:

1. Approved exercises whose concept is a primary concept of the current lesson.
2. Difficulty from the band: unseen or weak → beginner/easy, working → intermediate, strong → advanced.
3. Exclude exercises the student passed in the last 14 days.
4. Prefer an exercise whose trap codes overlap active misconceptions.
5. If none exist, stay on authored check questions and record a content gap. Do not call `generate_exercise` synchronously inside the lesson.

Phase 3 generation fills gaps offline into `review_status = pending`. Students only see `approved`.

## Interviews and projects

Both read the same `skill_mastery` and `misconceptions` rows.

An interview kind maps to a concept set and a target band (junior 60, mid 75, senior 85). The interviewer asks from concepts under the target first. The grade at the end is one strong-model call writing `interview_scores`, plus learning events for concepts that were clearly wrong or clearly strong. A 40-minute cap and a turn cap are part of the session, because this is one of the expensive features.

A project is a tree: project, milestones, tasks, subtasks. The student marks a task ready. The mentor reviews that task's diff or files. The mentor does not rewrite the project. Reviews comment on the task's acceptance notes from the seed.

## Learning science choices worth keeping

- One question at a time. Multiple checks in one speech split attention and are hard to score.
- Hints before answers. The reveal is a tracked state, not the default voice.
- Success on the first try is stronger evidence than success after the solution was shown. Weights encode that.
- Spacing is the 21-day decay plus the dashboard weak list, not a separate flashcard app in Phase 1.
- Unseen skills stay out of the weakness list so the product does not scold the student for the lessons they have not taken.
