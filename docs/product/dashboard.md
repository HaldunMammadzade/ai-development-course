# Dashboard

The student dashboard is the learning command center at `/app/dashboard`. It does not decide what the student should learn. That decision stays in the existing catalog: `nextAction`, lesson availability, adaptive focus, and mastery bands.

## Information architecture

1. Continue. The server's next action: start a lesson, continue an open lesson, do due homework, review a concept, or the completed path.
2. Today's focus. The catalog focus, shown only when its reason is not `baseline`. Baseline means there is not enough evidence yet, so the next lesson stays the only prompt.
3. Current path. Count of published lessons the catalog marks `completed`, over the published lesson count. The current module is the module of the current lesson.
4. Weak concepts. Up to three concepts the catalog already marks `weak`, with the sentence “Bu mövzu hələ zəifdir.” and a link to the lesson that introduces the concept. Confidence is not shown.
5. Homework. Assigned items only. No assignment is one sentence, not a card.
6. Project. The first published project the existing project list returns, preferring one that is not completed. Milestone title comes from that project's detail when the detail loads. An empty list uses the existing rule: the project opens after the HTML lessons.
7. Recent activity. The latest six learning events already stored for the student: source and concept name. No events means the section is absent.
8. Skills. Concepts that already have a mastery score, grouped by module. A new student sees “Bacarıq xəritəsi dərsdən sonra görünəcək.” Concepts with no score are omitted, so the page does not fill with zeros.

Streak and achievements are omitted. Daily activity exists in the database, but no streak calculation is part of the product yet. There is no achievement record.

## Data sources

One catalog read (`GET /api/v1/learning/catalog`) now also returns at most six recent learning events. Homework and the project list stay separate reads so a failure in either one does not replace the next action with an error page. If a project is listed, its detail is loaded for the current milestone title. A failed detail still shows the list counts.

The catalog query for events is `userId`, newest first, limit 6. It does not recompute mastery.

Path counts are the catalog's `completed` and published lesson totals. They are not a second progress formula.

## Empty and returning states

A new student sees the first legal lesson, the path count at zero completed, the skill sentence, and the project sentence. Focus, weak concepts, and activity stay hidden.

A returning student sees the open lesson or due homework, a focus sentence when the adaptive reason is specific, weak concepts that have a weak band, scored concepts, and real events.

## Performance

The page is a server component. The dashboard model is a pure function of those responses. There is no client refetch. Secondary failures render in their own section with `role="alert"`.

## Accessibility

The next action is a link with a 44px target. Path and project meters use `role="meter"` and a text count, so color is not the only status. Headings follow the page order. Loading uses `aria-busy` and a screen-reader label.
