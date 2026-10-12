# Spaced revision

Spaced revision answers “what previously learned knowledge should I verify again?”

It does not answer “what do I know?” That stays with the existing mastery engine. It does not answer “what should I learn next?” That stays with the personalized path and `getNextAction`.

## Architecture

```text
Curriculum
  → concepts and prerequisites
  → learning events
  → stored mastery band
  → personalized path and adaptive teaching
  → spaced revision
```

Revision is a read model. `GET /api/v1/revision` and the catalog projection call `buildRevision`. Nothing in that function writes mastery, events, scores, or lesson access. Completing a review means passing an existing exercise. The existing attempt transaction records the learning event and recalculates mastery. The next read rebuilds the schedule.

There is no revision table. Successful events and the stored mastery band are enough to decide eligibility, state, and order.

## Eligibility

A concept is eligible only when all of these are true:

- It is on a published lesson.
- That lesson is current or completed. A locked lesson stays out of the queue.
- The stored band is `fragile`, `working`, or `strong`. `masteryBand` is unchanged.
- There is at least one successful learning event.
- A published exercise for that concept sits on an open lesson.

Unknown concepts, concepts with no events, unpublished concepts, and speaking events are not eligible. A weak concept stays with the existing adaptive flow and is not shown as ordinary revision.

## Evidence

A successful event has evidence of at least 80. That is the same floor `classifyStoredEvidence` already uses for a success. The sources that can qualify are `lesson_check`, `exercise`, `quiz`, `homework`, `project`, `interview`, and `code_review`.

Assessment qualifies only when the stored quiz event is a success. A failed assessment item is written at 20 and does not start a schedule. Passing an assessment does not put every assessed concept into today’s queue; the lesson must also be open, an exercise must exist, and the interval must have elapsed.

Speaking evidence is fixed at 40 and is ignored even if a higher number were stored. Conversation text is not evidence.

A failed exercise writes no learning event under the existing attempt rule, so it does not complete a review and does not change mastery. A later successful attempt does both, through the existing path, once.

## Scheduling

The interval is a scheduling rule, not a mastery score. It uses the existing decay constant of 21 student-calendar days:

| Successful events | Days after the latest success |
| ----------------- | ----------------------------- |
| 1                 | 21                            |
| 2                 | 42                            |
| 3 or more         | 63                            |

Age is `studentDayAge` in the learner’s stored timezone, the same calendar helper mastery decay already uses. Baku applies when that timezone is `Asia/Baku`. The browser clock and any client `dueAt` are ignored.

- Age below the interval, and this is the first success: **Hələ vaxtı deyil.**
- Latest success is today and there was an earlier success: **Bu mövzu yenicə təkrarlandı.**
- Age is at least the interval and less than one extra decay window: **Təkrar vaxtıdır.**
- Age is at least one extra decay window past the interval: **Təkrar gecikib.**

A future timestamp has age 0, so it cannot become due.

## Queue

Only due and overdue concepts are returned, at most 5. Order is deterministic:

1. Overdue before due.
2. Strong, then working, then fragile.
3. Longer past the interval first.
4. More successful events first.
5. Concept slug.

Concepts past the limit stay eligible on the next read. Skipping the page writes nothing and does not lower mastery.

## Surfaces

The dashboard keeps the legal next action as the primary action. When the queue is ready it adds a short **Təkrar vaxtıdır** section and a link to `/app/revision`. An empty learner does not get a fake count there.

`/app/revision` is the focused queue: today’s concepts, then the existing lesson that holds the chosen exercise. The exercise is the earliest published exercise on an open lesson for that concept. Opening the lesson is not completion.

The skill map keeps the mastery sentence. Due, overdue, and just-reviewed concepts add the revision sentence underneath.

## Security and performance

The endpoint requires a verified student session. It accepts no body. Query parameters do not change the queue. Repeated and concurrent reads do not insert events. Locked exercises stay unavailable through the existing exercise authorization. The response has names, lesson slugs, and the revision state. It does not include scores, intervals, event ids, or exercise rules.

The extra read is one grouped count of successful events and one published-exercise lookup, beside the catalog query that already loaded mastery. There is no model call, cache, or background scheduler.

## Known limitations

Fragile and working concepts can be reviewed once they have a real success. A concept that only has partial evidence below 80 is not eligible. A strong concept on a still-locked lesson waits until that lesson is legally open. A failed exercise does not itself create adaptive teaching; adaptive decisions still run from stored evidence when teaching or the catalog focus is built. The queue does not generate new questions.
