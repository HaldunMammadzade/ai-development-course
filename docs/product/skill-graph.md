# Skill graph

The skill graph is a read-only picture of the learner’s current capability. It does not decide what the learner is allowed to do.

Date: 8 October 2026.

## Data source

One catalog response already loads the published curriculum, mastery rows, prerequisite edges, the personalized path, and recent activity. `presentLearningCatalog` builds `catalog.skill` from that same data.

The page does not fetch the curriculum again. There is no second mastery query and no new mastery formula. The latest evidence source is one extra bounded read: the newest learning event per concept, selected with `distinct` on `conceptId` and ordered by time. The response keeps the source name only.

Concept summaries come from the existing concept row, included in the catalog query that already loads the concept name.

## Mastery states

The graph labels the existing `masteryBand` result. It does not add a threshold.

| Existing band                                        | Skill state | Sentence                   |
| ---------------------------------------------------- | ----------- | -------------------------- |
| no row, or score below 45 with fewer than 2 evidence | unknown     | Hələ yoxlanmayıb.          |
| weak                                                 | weak        | Üzərində işləmək lazımdır. |
| fragile or working                                   | developing  | İnkişaf edir.              |
| strong                                               | strong      | Möhkəmdir.                 |

There is no mastered state in the mastery engine, so the graph does not invent one. A concept that has not been checked is unknown. It is not shown as weak. The primary text is the sentence. The graph does not show a percentage.

Module lines count those states. They are not an average or a weighted score.

## Concept graph

The map is modules, then the concepts taught by the published lessons in those modules. A concept appears once, on the first published lesson that teaches it. Draft lessons are omitted. An edge whose endpoint is outside that set is dropped, and it does not create a node.

## Prerequisites

Prerequisite rows already used by unlock and the personalized path are drawn only after a concept is selected. The detail lists direct prerequisites and direct dependents, each with its own state sentence. The whole curriculum is not drawn as one network.

## Path integration

Current focus is `catalog.personalized`. The progress page shows that path as “Öyrənmə yolu” and the map as “Bacarıq xəritəsi”. The graph does not choose the next lesson, reorder the path, or skip a locked lesson.

A lesson link is rendered only when that lesson’s catalog availability is `current` or `completed`. A locked lesson stays text: “Bu dərs hələ açılmayıb.”

## Concept detail

The selected concept shows its name, state sentence, curriculum summary, direct relations, related lesson title, and the legal lesson action when the server already opened that lesson. Latest evidence, when a real event exists, is a source sentence such as “Son yoxlama: Məşq”.

The detail does not show a concept id, the mastery formula, a score, an AI prompt, a model name, token use, a hidden test, or event metadata.

## Evidence

Evidence text uses the same source labels as the dashboard activity list. If the learner has no event for that concept, the line is omitted.

## Misconceptions

The database has a misconception table. No product path writes it. The graph does not invent a misconception sentence.

## Dashboard integration

The dashboard replaces the percentage skill bars with a short snapshot: current module from the path, up to three weak names, up to three strong names, the unknown count, and a link to `/app/progress`. Empty skill data renders nothing. It does not show a zero score.

A weak concept on the dashboard links to its lesson only when that lesson is already current or completed.

## Progress integration

`/app/progress` is the map. The order is the page title, the learning path, the skill map, weak concepts, strong concepts, and the module counts. There is no second route.

## Responsive behavior

From 1280px the map and a 340px detail column sit side by side. Below that, choosing a concept opens a sheet. Escape or “Bağla” closes it. At 390px the page stays one column: path, modules, concepts, then the sheet. Modules other than the current path module start closed. There is no horizontal graph.

## Accessibility

Every state is a sentence, not only a color. Concept rows are buttons in lists. The selected row sets `aria-current="true"`. Module groups are `details`. Actions are at least 44px. Focus uses the existing focus ring. The sheet is a dialog and returns focus when it closes. The map does not animate.

## Performance

The progress page is a server component. Selection state is the only client state. The catalog payload is bounded by the published frontend curriculum plus one latest event per concept the learner has touched. There is no AI call, WebSocket, SSE, Redis, or vector database.

## Security

The graph is a projection. The client cannot write mastery, change a state, unlock a lesson, or edit a prerequisite. The learning catalog route remains `GET /api/v1/learning/catalog`. A direct request for a locked lesson still stops on the existing lesson page.

## Testing

Curriculum tests cover unknown versus weak, the existing band boundaries, prerequisite and dependent links, an isolated concept, duplicate nodes, path focus, and a locked lesson flag. Web tests cover the snapshot, a locked weak link, and the rendered map: real names, real evidence labels, no score, and no internal id.

## Known limitations

Fragile and working share the sentence “İnkişaf edir.” The mastery numbers stay different; only the label is shared.

A concept with one piece of evidence and a score below 45 stays unknown, because that is what `masteryBand` already returns.

The latest evidence line is the newest event for that concept. It is not a history.

Misconceptions are not shown, because the product does not store student-facing misconception rows yet.

The map does not repair the gap where a later concept can be strong while an earlier unassessed lesson still gates the path. The path and the map both show that gap. Neither one opens the later lesson.
