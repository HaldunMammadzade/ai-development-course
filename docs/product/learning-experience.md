# Learning experience

The lesson at `/app/learn/[lessonSlug]` is the student's workspace. It does not decide what is legal to learn. Opening a session, advancing, answering, scoring an exercise, and choosing the next lesson stay on the existing server.

## Information architecture

The page is one column until 1280px. From there, the teacher sits in a 360px column. The application sidebar stays 240px from 1024px. A third column is not added, so the editor keeps the width of the lesson stage.

1. Header. Module title, lesson title, and the lesson's place in that module (`Dərs 1 / 4`). The state name is the existing teaching-phase label.
2. Objective. The curriculum objective, when the catalog has one.
3. Current block. Reading, check question, or recap. Reading stays paragraphs. A paragraph that is only a tag or fenced code uses the code surface. The check is the question, with the answer field under it.
4. Next action. Start, continue, send an answer, or the completion link. One of these is visible for every open state.
5. Teacher support. Below 1280px this is a short status, the latest teacher note, and a button that opens a sheet. From 1280px the same notes stay in the side column.
6. Exercise. Published exercises for the lesson, under the teaching action. A failed exercise load is an error in that section. No published exercise means the section is absent.
7. Outline. Previous, current, and next lessons from the catalog. A locked lesson has no link. The reason is that the server has not opened it.

## Lesson states

The composer mode is unchanged: answer, advance, homework, done, or closed. `created` asks the student to start. Question states (`prior_check`, `comprehension_check`, `evaluate`) show the answer field. `completed` shows the objective, the lesson's concepts, and the server's next action. `abandoned` offers a restart. If opening the session fails, the error and retry stay in the lesson column. Exercises still render.

## Teacher states

The panel status is one of: thinking, ready, explaining, question, hint, feedback, error, or idle. Thinking is the existing static line. A failed turn sets the error status and leaves the lesson usable. The panel does not show system prompts, model names, token counts, or mastery formulas.

## Exercise states

Code exercises keep Monaco, without extra extensions. The font is IBM Plex Mono. The task is above the editor, and the editor is the full width of the lesson column. Pass says “Düzgün”, then links back to the lesson action. Fail says “Keçmədi”, then the existing retry sentence and the public rule feedback. The student's code stays in the editor when a request fails. Color is paired with those words and a left border.

## Adaptive UI

The latest teaching turn can include an adaptive decision. The lesson shows a sentence for reexplain, hint, retry, review, challenge, and remediate. Continue is not announced, because the advance button already says to continue. A catalog focus with reason `baseline` is hidden. Enum names are not shown.

## Failure and success

A wrong answer or a failed exercise stays in the workspace with the next action: retry, hint, or the teacher note. Passing an exercise does not add a celebration. Completing a lesson names what the objective said, lists the lesson concepts, and links only the server's next homework or current lesson.

## Responsive behavior

At 390px the order is header, objective, block, answer or exercise, result, teacher support, then the action that belongs to that state. The teacher sheet includes its own close button, because the panel is wide enough that the dimmed backdrop is only a sliver. Horizontal scrolling is limited to a code paragraph or the editor.

## Accessibility

One `h1` is the lesson title. The objective, block, teacher, and exercise are `h2`. The answer field keeps its label. Pass and fail include text. Targets that the student must press are at least 44px. Loading uses `aria-busy` and a screen-reader label, not sample lesson text.

## Performance

Catalog and exercises are read on the server. The teaching session is still opened by the existing client request, because that request creates or resumes server state. Turns are unchanged. The outline does not fetch a second catalog until a lesson completes, which was already the case. No cache, socket, or stream was added.
