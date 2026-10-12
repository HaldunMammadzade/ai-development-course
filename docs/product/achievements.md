# Achievements and learning milestones

Achievements make real learning progress visible. They do not reward opening the product, and they do not change what the learner is allowed to do.

## Purpose

The page answers: which meaningful stages has this student actually finished?

It does not answer: how many points, badges, or days in a row they have.

## Philosophy

An achievement is a read-only interpretation of evidence the product already stores.

```text
Curriculum
  → learning evidence, lesson progress, assessment, project passes, interview sessions
  → existing completion rules
  → milestone rules
  → achievements
```

Reading the list does not write mastery, learning events, lesson progress, revision state, or the next action. The client cannot submit an earned flag.

## Categories

| Category    | Azerbaijani | What it recognizes                                                                     |
| ----------- | ----------- | -------------------------------------------------------------------------------------- |
| `learning`  | Öyrənmə     | A finished lesson, and a later successful confirmation of something already learned    |
| `skill`     | Bacarıq     | A completed initial assessment, and a module whose published lessons are all completed |
| `practice`  | Praktika    | The first passed exercise                                                              |
| `project`   | Layihə      | The first published project whose milestones are all passed                            |
| `interview` | Müsahibə    | The first completed interview session                                                  |

## Definitions

| Id                       | Title                    | Earned when                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `first-lesson`           | İlk addım                | Any published lesson has progress `completed`. Time is the earliest `completedAt`. Omitted when the path has no published lesson.                                                                                                                  |
| `first-revision`         | İlk təkrar               | Some concept has two distinct learning events with evidence at least 80, excluding speaking. Time is that second event. A repeated event id counts once.                                                                                           |
| `skill-map`              | Bacarıq xəritən hazırdır | The skill assessment status is `completed`. `skipped` and `in_progress` stay locked, even if a time was stored.                                                                                                                                    |
| `html-foundations`       | HTML əsasları            | Every published lesson in module `html` is `completed`. Time is the latest `completedAt`. Draft lessons are ignored. The row is omitted if that module is absent or has no published lesson.                                                       |
| `css-foundations`        | CSS əsasları             | Same rule for `css`.                                                                                                                                                                                                                               |
| `javascript-foundations` | JavaScript əsasları      | Same rule for `javascript`.                                                                                                                                                                                                                        |
| `typescript-foundations` | TypeScript əsasları      | Same rule for `typescript-fundamentals`.                                                                                                                                                                                                           |
| `react-foundations`      | React əsasları           | Same rule for `react-fundamentals`.                                                                                                                                                                                                                |
| `nextjs-foundations`     | Next.js əsasları         | Same rule for `nextjs-fundamentals`.                                                                                                                                                                                                               |
| `first-exercise`         | İlk məşq                 | The earliest learning event whose source is `exercise`. A failed attempt writes no event, so it cannot earn this.                                                                                                                                  |
| `first-project`          | İlk layihə               | A published project with at least one milestone has a pass row for every milestone. Time is the earliest such project completion, and a project's completion is its latest milestone `passedAt`. Omitted when no published project has milestones. |
| `first-interview`        | İlk müsahibə             | The earliest interview session with status `completed` and a `completedAt`, on a published interview. Opening or abandoning a session does not count. Omitted when no interview is published.                                                      |

Module rows are an allowlist of stable module slugs. A renamed title in the curriculum does not retarget the rule. A new module does not appear until its slug is added to that allowlist. Completion is never “70 percent of lessons” and never a lesson count.

## Data sources

One read, in parallel:

- the enrolled path’s modules and lessons, with that student’s lesson progress
- qualifying learning events: exercise events, and non-speaking events at evidence 80 or above
- the skill assessment row
- published projects and their milestone ids
- that student’s project milestone passes
- whether a published interview exists, and the earliest completed session

No achievement table. No new migration. Times shown in the interface come from those rows. If a completed assessment has no time, the milestone is still earned and the date is omitted.

## API

`GET /api/v1/achievements`

Authenticated, verified email, read-only. The body is `{ items, earnedCount, latest }`. `latest` is the earned item with the newest `earnedAt`. There is no POST. A body that claims `achievementId`, `earned`, or `earnedAt` is not a route.

The response does not include scores, event ids, mastery, or hidden curriculum.

## UI

`/app/achievements` is an editorial list grouped by category. Earned rows use stronger type, a check, and “Qazanıldı · 8 oktyabr” when a time exists. Locked rows say “Hələ qazanılmayıb”. A new student sees “Hələ qazandığın nailiyyət yoxdur.” plus the locked stages, not a zero.

The dashboard shows “Son nailiyyət” only after something is earned. Progress shows the count only when it is greater than zero, under “Öyrənmə mərhələləri”, and the skill map stays the competency view. Nothing interrupts a lesson with a modal.

## Security

The list is the signed-in student’s own rows. Unpublished lessons do not complete a module. Draft lessons do not earn the first lesson. The server recomputes the list on every read, so two reads of the same evidence return the same items, states, and times.

## Future extension

Add a row only when a stable curriculum, project, or interview identifier already exists and an existing completion rule can decide it. Do not add points, streaks, leaderboards, certificates, sharing, or an AI that invents milestones.
