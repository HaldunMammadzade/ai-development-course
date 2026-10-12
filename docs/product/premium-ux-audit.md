# Premium UX audit and redesign foundation

Status: audit and specification, 9 October 2026. Dashboard hierarchy (section 12), the lesson workspace (section 13), and exercise input selection (section 14) were implemented on 10 October 2026. The remaining token work is still open.

Date: 9 October 2026.

Lindel stays a personal AI programming teacher, not a course catalog. This document records what the current interface actually does, the one design direction for the next workspace pass, and the three journeys to build first. It does not replace `docs/brand/design-system.md` or `docs/product/premium-ux-principles.md`.

Business rules stay where they are: `getNextAction`, mastery, scoring, curriculum, exercise evaluation, project verification, and the execution boundary.

## 1. What was inspected

### Source

- Shell and navigation: `apps/web/components/app-shell/app-shell.tsx`
- Dashboard: `apps/web/components/dashboard/dashboard-view.tsx`, `apps/web/components/curriculum/path-rail.tsx`, `apps/web/app/app/(study)/dashboard/loading.tsx`
- Lesson and teacher: `apps/web/components/teaching/lesson-experience.tsx`, `apps/web/components/teaching/lesson-workspace.tsx`, `apps/web/components/teaching/teacher-thinking.tsx`, `apps/web/app/app/(study)/learn/[lessonSlug]/loading.tsx`
- Practice: `apps/web/components/exercises/exercise-board.tsx`, `apps/web/components/exercises/exercise-result.tsx`, `apps/web/components/exercises/coding-editor.tsx`, `apps/web/components/exercises/monaco-pane.tsx`
- Git and testing practice pages: `apps/web/components/git/git-workspace.tsx`, `apps/web/components/testing/testing-workspace.tsx`
- Auth: `apps/web/components/auth/auth-form.tsx`
- Tokens and primitives: `apps/web/app/globals.css`, `apps/web/components/ui/button.tsx`, `apps/web/components/ui/card.tsx`, `apps/web/components/layout/primitives.tsx`
- Existing direction: `docs/brand/design-system.md`, `docs/product/premium-ux-principles.md`

### Browser, 9 October 2026

Production web build on port 3010. The API on port 3001 did not answer a three-second health check, so signed-in screens were not opened.

Visually checked:

- `/login` at the default desktop width and at 390px. No page overflow at 390. Email field is 44px tall. Computed field fill is `rgb(247, 246, 242)` on the white card, border `rgb(189, 186, 176)`. The product name is indigo (`text-primary`), not ink.
- `/` at a 1440px emulated viewport. Document scroll width equals 1440. The headline box is 672px wide and uses normal wrapping. The page does not overflow.

Not visually checked in this step: dashboard, lesson workspace, exercise board, Git page, testing page, TaskFlow. Those findings below are from source unless a sentence says they were seen.

## 2. Findings, by impact

### The next step is easy to miss after the hero

`DashboardView` puts the next lesson in one large heading and one primary link. Every section after that uses the same label: `text-sm font-medium text-muted-foreground`. Focus, path, revision, weak concepts, homework, project, activity, and skill snapshot are the same visual weight. A student who already has data sees a long column of equal chapters inside `max-w-3xl`, not a workspace.

The shell does not repeat the next action. `app-shell.tsx` lists thirteen destinations in four groups. Practice alone has homework, projects, Git, testing, interviews, and speaking, all the same size. The thing to do next lives only on the dashboard.

### The teacher is a side door below a wide screen

`LessonWorkspace` is one column until `xl`, then a sticky 22.5rem aside. Below that width, `TeacherSupport` shows a status line and a button that opens a sheet. The lesson text and the teacher are not one surface on a phone or a tablet. The lesson body also waits on `POST /api/v1/teaching/sessions`. The route `loading.tsx` draws a skeleton, then the client phase `"loading"` draws another. Two loading states in a row, both source-visible, neither timed.

`TeacherThinking` is a sentence and the mark. There is no streamed partial answer in this UI. Waiting, failure, and retry are text plus a button. Cancellation of an in-flight turn is not exposed.

### A one-line answer still opens a code editor

`CodingEditor` is `min-h-[320px]` and up to 52dvh. `monaco-pane.tsx` imports `monaco-editor` and is loaded only for `code_text`. A choice question does not pay that cost. A text answer such as `5` or `[]` does. The board is a `.surface` card with its own border, sitting under the borderless Git and testing columns. The result panel already says pass or fail in words, with a score and a left rule. That part matches the design system.

Non-executing exercises must keep the existing sentence that code is not run. Do not add a Run control for them.

### Hierarchy tokens exist and are not what the screens use

`globals.css` defines `--type-h1` through `--type-caption`, spacing, and motion. Screens use Tailwind sizes (`text-4xl`, `text-sm`) instead. `--color-text-secondary` is set in light and dark and is not referenced by any component. Supporting copy uses `text-muted-foreground` only, so eyebrows, section titles, and metadata share one gray.

Light theme sets secondary and muted to the same hex (`#5e5e57`). Dark theme separates them. Because secondary is unused, that light-theme collision is not currently visible. It will matter when section titles start using it.

Containers overlap: `.surface`, `.chapter`, `Card`, and `Panel` (`layout/primitives.tsx`). Radius stays 4, 6, and 8. Shadows are defined and then `--shadow` is `none`. That restraint should stay.

### Auth fields look washed out

Seen on `/login`. `inputClass` uses `bg-background`, the page canvas, inside a white card. The dedicated `--color-bg-input` (`#ffffff` in light) is not used. The border is the strong token, but on the pale fill the empty field reads as a faint trough. “Parolu göstər” sits as a text control under the field, easy to miss as an action. The primary button is clear. At 390 the form fits.

The public home is a single headline and three links. It is not one of the three journeys below. Measured layout does not overflow at 1440.

## 3. Direction: Premium AI Learning Workspace

One direction. Not a new palette.

Keep:

- Warm paper `#f7f6f2` and ink `#20201d`. Dark canvas `#11110f` stays the other complete theme.
- Indigo only for the current action, the selected nav mark, and links.
- Inter and Inter Tight. Weight 600 on headings. Measure near 65ch.
- Radius 4, 6, 8. No new shadow system. No gradients, no chat bubbles, no streaks.
- Motion 150–180ms, removed under `prefers-reduced-motion` (already in `globals.css`).
- Words for pass, fail, lock, and practice. Color is a second signal.
- Public name Müəllim. The indigo word on the login card can stay as the product name; the Lindel mark stays ink, as the design system already says.

Change, in a later implementation pass:

- Make the next action persistent and visually first. Other sections recede.
- Put the teacher in the same column as the task on small screens, not only behind a sheet.
- Use the editor height the answer needs. Keep Monaco for real code. Keep the “not executed” sentence for authored checks.
- Use the type tokens for a real scale: one display title, one section title, body, and caption. Section titles should not be the same class as metadata.

### Tokens to retain

Canvas, surface, ink, muted ink, indigo, success `#3f735a` / `#75b798`, warning, error, focus ring, the space scale, the radius scale, the motion curve.

### Tokens to start using

`--type-*` for the three journeys, instead of one-off Tailwind sizes. `--color-text-secondary` for section titles once it is distinct from muted in both themes. `--color-bg-input` for fields that sit on a white card, after a contrast check. Do not invent a third text color.

### Patterns

- Button: the existing `Button`. One primary per view. 44px minimum.
- Input: visible fill, strong border, global focus ring. Error text under the field, not color alone.
- Navigation: current page uses the existing inset accent. Do not add a second nav.
- Tabs: the exercise switcher already uses `aria-pressed`. Keep that. Do not add a tab library.
- Dialog: the existing `Sheet`. Escape already closes the exercise reset confirm.
- Feedback: `ExerciseResult` is the model. Status word, score, explanation, next link.
- Loading: one skeleton per route. Do not stack the route skeleton and a second client skeleton for the same block.
- Empty: one sentence and one action, already the homework empty line.
- Streaming: until the API streams, the waiting state is the existing thinking line. Do not fake tokens.

## 4. Journey A — Dashboard / learning home

File to change later: `dashboard-view.tsx`, reusing `PathRail`, `Progress`, and the hero link. Do not change `DashboardModel` or `getNextAction`.

Layout, top to bottom, still inside the shell:

1. Greeting, one line, caption.
2. Next lesson. Display title, module and minutes, one sentence of why this lesson is next (the existing objective or description). One primary button, the existing action label.
3. A quiet line for the teacher: the lesson is where the teacher speaks. Link only if that lesson is the server’s current lesson. Do not embed a chat transcript on the dashboard.
4. Path: the current concept, then at most the next few names from `PathRail`. Known concepts stay a single muted sentence, not a second list of equal cards.
5. One secondary block, chosen by data, in this order: revision if due, otherwise the project if present, otherwise homework. The others move below a “More” disclosure or stay as text links. They are not four more chapters of the same height.
6. Latest achievement and activity stay last, caption sized.

States:

- New student: hero plus an empty path note. No fake statistics.
- Loading: the existing dashboard skeleton only.
- Error: the existing page error, with retry. Do not invent scores.

Responsive: one column at 390 and 768. At 1024 and above, the path may sit beside the hero only if the hero remains the taller, first element. The current `lg:grid-cols` split is acceptable if the hero is not visually equal to the rail.

Accessibility: the hero heading is the `h1`. Section titles are `h2`. The primary control keeps the global focus ring. Status words stay in the path rail.

## 5. Journey B — Lesson and teacher

Files later: `lesson-workspace.tsx`, `lesson-experience.tsx`. Session open, turn payload, and redirects stay as they are.

Desktop, 1280 and 1440:

- Left: module label, title, state in words, objective, the current block (reading, question, or recap), the answer field or the advance button, then the result of the last turn.
- Right, sticky: teacher name, the thinking or ready line, the teacher turns for this block. Not a full chat history styled as bubbles. `TeacherMessage` stays a labeled block.

1024 and below:

- Same column. The teacher block sits under the question and above the composer, already expanded for the current turn. The sheet remains for older turns, opened by the existing button. The student should not have to open a sheet to see the question they are answering.

Feedback: correct and incorrect stay in the teacher speech the server sends, plus the existing notice list of updated concepts. Do not add a second score on the lesson.

Next action: the completion block already has one primary link. Keep it. While the lesson is open, the advance button is the only primary.

Loading: show the title from the catalog immediately. Skeleton only the block that is waiting on the session. Remove the double skeleton by letting the route loading cover the first paint and the client skip a second full-page skeleton when the title is already known.

Error: the existing alert and retry. AI unavailable keeps `copy.errors.ai`. No cancel control until the turn API supports cancel.

## 6. Journey C — Coding and practice

Files later: `exercise-board.tsx`, `coding-editor.tsx`. Validation, idempotency, and `execution: null` stay.

Regions, in order:

1. Task title, prompt, and the expected outcome. Max about 65ch for the words.
2. Answer. Choice: the existing fieldset, 44px rows. Compact text only when section 14’s rule matches. Program text: Monaco, with the current minimum height. A short starter is not the signal.
3. Check. One primary button, label “Yoxla”. Disabled while pending, label switches to the existing working copy. No Run button when `executionAvailable` is false. Keep the sentence that execution is off.
4. Result: the existing `ExerciseResult`. Pass and fail in words. The explanation is the server feedback. Link back to the lesson action only when the exercise sits inside a lesson that has `#lesson-action`.
5. Teacher help stays the lesson teacher, not a second composer inside the exercise card.
6. Next step is the next exercise tab if one remains, otherwise the lesson’s next action. The board does not refresh the path by itself today. A later pass may call `router.refresh()` after a pass. That is a behavior change and needs its own check so it does not start a teaching session.

Git and testing pages keep the editorial column and drop the exercise board under it. Do not give them a second chrome.

Responsive: the editor is `min-w-0` and `overflow-x-auto` on code samples. Page scroll width must match the viewport at 390, 768, 1024, 1280, and 1440. Long Azerbaijani prompts already use `break-words`.

Accessibility: fieldset legend stays screen-reader-only if the visible title is the same string. Focus ring on the check button comes from `Button`. Result uses `role="status"`.

## 7. Performance

Verified from source, not from a profiler:

- Lesson route skeleton, then a client skeleton, then the session request. The body cannot paint the block until that POST returns.
- Exercise submit sets `pending` and disables the button before the response. That feedback is immediate in code. The history refetch happens after the score is stored in state, so the result can show before the history list updates.
- Monaco is dynamically imported only when the answer surface is code. A compact text answer does not load that chunk. The pane still imports the full `monaco-editor` module once a code exercise opens it.
- Global reduced motion already shortens transitions.
- No measured API latency, time to first byte, or frame time in this audit. The hung health check is not a latency number.

Needs a later runtime profile:

- Byte cost of the Monaco chunk after a code exercise opens it. A short text answer no longer loads it.
- Time from “Yoxla” to the result on a warm API.
- Time from opening a lesson to the first teacher sentence.
- Whether the dashboard catalog request blocks the hero.

Do not change provider routing, streaming, prompts, or the runner in the design pass.

## 8. Implementation order

1. Dashboard hierarchy only. Highest impact, data already on the page, no API change.
2. Lesson column so the current teacher turn is on screen below `xl`.
3. Short-answer field. Done in section 14. The signal is exercise metadata, not the length of an answer.
4. One loading state on the lesson route.
5. Apply type tokens and a distinct secondary text color. Check contrast before shipping the lighter muted ink.
6. Auth field fill, using `--color-bg-input`, only after the card-versus-field contrast is checked in both themes.

Do not redesign the shell, the skill map, interviews, speaking, or billing in that pass.

## 9. Files changed in this step

- `docs/product/premium-ux-audit.md` created.
- `docs/brand/design-system.md` points at this audit in one sentence. Tokens are unchanged.

No application source was changed. No dependency was added. No migration.

## 10. Checks

Lint, typecheck, unit tests, and the production build were not re-run. This step did not change executable source.

## 11. Unverified

- Dashboard, lesson, Git, testing, and TaskFlow were not opened in the browser in the 9 October audit because the API did not respond. The dashboard was opened on 10 October; see section 12.
- Contrast ratios were not measured with a picker. The login field colors above are computed styles from the page.
- AI response time was not measured.
- Whether a signed-in student on a populated dashboard feels the equal-weight chapters was inferred from the component structure during the audit. That layout is what section 12 replaces.

## 12. Dashboard hierarchy, 10 October 2026

### Before and after

Before, the hero and every later block shared the same muted section label. Focus, path, revision, homework, project, activity, and the skill snapshot read as one column of equal chapters.

After, the page answers four questions in order, still from `DashboardModel`:

1. What next: the server hero is an `h1` at `--type-display-lg`, with the existing eyebrow, module, minutes, and description.
2. Why: that description is the existing lesson objective. A teacher sentence appears only when the hero link is a start or continue action for a lesson the server already exposed.
3. Where: `PathRail` when `model.route` exists, otherwise the existing numeric path. Marks stay the server words İndi, Artıq bilir, Növbəti, and Təkrar. Upcoming names are text, not links.
4. What else: at most one secondary block. The order is the audit order and is presentation only: revision when the queue is ready and non-empty, otherwise an incomplete project, otherwise assigned homework. Anything else sits under “Daha çox”.

The primary control is one link, `min-h-11`, indigo, label taken from `hero.action`. There is no arrow appended. `getNextAction`, `DashboardModel`, and the page loader are unchanged. The client does not pick a lesson.

`PathRail` gained an optional `emphasis` flag, default false, so assessment, progress, and the path list keep their previous heading. The dashboard passes `emphasis`.

### States

- Loading: the existing dashboard skeleton only (`dashboard/loading.tsx`). It was not captured in the browser because the page arrived already rendered.
- New student, seen in the browser: greeting, “Yol buradan başlayır.”, the first lesson “Brauzer səhifəni necə alır”, “Dərsə başla” to `/app/learn/how-the-web-delivers-a-page`, path marks, and no secondary feature. “Daha çox” holds the empty homework sentence and the server skill snapshot (“104 hələ yoxlanmayıb”), not a percentage.
- Revision, in-progress project, and assigned homework: covered by `dashboard-view.spec.tsx` with fixtures. A returning session with those records was not opened in the browser.
- No next href: the primary link is omitted. That completion path is in the model and was not the live session.
- Locked: the only lesson links on the dashboard were the current unlocked lesson. The lesson page reached from “Dərsə başla” still marks the following lesson “Bağlıdır”.
- API error for homework or project: an alert outside the disclosure, using the existing message. The route error boundary still offers “Yenidən cəhd et”. Neither error was triggered live.
- Focus is a sentence and a text link when the server sends one, not a chapter. The new student had none.

### Browser

Production web on port 3010, API health `GET /api/v1/health/live` returned 200. A new verified student signed in through the normal forms and skipped assessment with “Başlanğıcdan başla”. Authentication was not bypassed.

Measured document scroll width equals client width, the title is not clipped, and the primary control is 44px and inside the viewport:

- 390
- 768
- 1024
- 1280
- 1440

At 390 the title wraps onto a second line and stays fully visible. At 1440 the title is one line from x 280 to 662 inside a 768px column. A screenshot crop can look cut off; the text range measurement does not.

Dark theme was toggled with the existing “Qaranlıq” control at 1440. Canvas text is white, the primary stays indigo (`rgb(88, 101, 216)`), and scroll width stays 1440. Light was the theme during the width sweep.

Accessible names from the tree: “Dərsə başla”, “Brauzer səhifəni necə alır”, “Daha çox”, “İndi HTTP”, “Növbəti URL”. Path state is a word, not color alone. The global `:focus-visible` rule and matching classes are on the primary link, text links, and the disclosure. A pointer click focuses the control and does not match `:focus-visible`. The browser tool’s key events do not move native focus, so the painted ring was not captured.

Reduced motion is the existing `globals.css` rule. The dashboard adds no animation of its own. It was not timed in the browser.

### Files

- `apps/web/components/dashboard/dashboard-view.tsx`
- `apps/web/components/dashboard/dashboard-view.spec.tsx`
- `apps/web/components/curriculum/path-rail.tsx`
- `apps/web/lib/copy.ts`
- `docs/product/premium-ux-audit.md`

No dependency. No schema or migration. No change to `getNextAction`, mastery, scoring, auth, or API contracts.

### Checks, 10 October 2026

`EXECUTION_MODE=fake pnpm test --concurrency=1` with the local environment loaded: 20/20 tasks, exit 0. Web tests executed on this run: 32 files, 65 passed, 0 skipped, including 3 dashboard view tests and 4 dashboard model tests. The other test tasks were turbo cache hits whose logs report config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, ai 80, api 111. Reported total: 482 passed, 0 skipped. Nest `ERROR` lines in the API log are the exception-filter tests.

`pnpm lint`: 11/11, exit 0, cache hit. `pnpm typecheck`: 22/22, exit 0, cache hit. `NODE_ENV=production pnpm build`: 11/11, exit 0. The web compile is hash `aa02504e49306d09`, compiled in 2.4s on the uncached force build that this cache replays. `/app/dashboard` is in the route list.

### Still open

- Type tokens beyond the dashboard hero and the lesson title, and a secondary text color only after a contrast check.
- Auth field fill.
- A live dashboard with revision due, an in-progress project, or assigned homework was not opened.
- The keyboard focus ring was confirmed in source, not painted in the browser.

## 13. Lesson workspace, 10 October 2026

### Layout

The lesson page owns the catalog and the locked-lesson redirect. `LessonExperience` owns the session, the turn, pending, retry, and redirects. `LessonWorkspace` only presents `LessonWorkspaceModel`.

Wide view, from the `xl` breakpoint (1280 and 1440): the lesson column stays primary. The same teacher panel is a sticky aside, 22.5rem, beside the lesson. The inline copy of that panel is hidden.

Below `xl` (390, 768, and 1024): one column. Order is the title and context, the current block, the current teacher turn, the student’s earlier answers, then the composer or advance button. Older teacher turns sit in “Əvvəlki izahlar” in that same column. The sheet and the “Müəllimi aç” button are gone. There is still one `TeacherPanel`, shown either inline or beside the lesson, not both at once.

### Loading

The route `loading.tsx` remains the skeleton while the server loads the catalog. After that paint, the client shows the catalog title and objective immediately. The session request uses the existing teacher status “AI müəllim düşünür...”. The second block skeleton is removed. A turn still disables the action and switches its label to “Gözləyin...” until the server responds. Restart and the route error boundary are unchanged.

### Teaching behavior preserved

Session open, turn payload, `clientTurnId`, redirects, locked lessons, and homework routing are unchanged. A ref blocks a second turn POST while the first is in flight, which is what the pending flag was already meant to do. Resizing does not remount the composer. A typed answer survived a change from 390 to 1440 in the browser.

### Browser, 10 October 2026

Production web on port 3010. API health returned 200. A new verified student signed in and skipped assessment. The first lesson opened through the normal session POST.

Initial state: title “Brauzer səhifəni necə alır”, reading “İzah”, status “İzah edir”, button “Dərsə başla”. No dialog. No page skeleton after the title was visible.

One real advance returned a server teacher speech and moved the lesson to “Sual verir”, with the answer field “Cavabını yaz...”. The speech was in the aside at 1440 and in the column at 390, above the field. The following lesson stayed “Bağlıdır”.

Scroll width matched the viewport, the title was not clipped, and the primary control was 44px:

- 390: inline teacher, aside hidden. After the turn, title, speech, field, and “Göndər” stacked in that order. The speech wrapped inside its box.
- 768 and 1024: same single column, no overflow.
- 1280: aside at x 880, width 360, beside the title. Inline teacher hidden.
- 1440: aside at x 1040, width 360. Title ended at x 992. No overflow.

Dark theme was already selected for the width sweep. Light theme at 1440: paper `rgb(247, 246, 242)`, ink `rgb(32, 32, 29)`, send button `rgb(79, 89, 200)`. The typed answer was still in the field.

The painted focus ring was not captured. Pointer focus does not match `:focus-visible`, and the browser tool does not move native Tab focus. The global rule and the button classes remain.

Not opened live: a lesson with more than one teacher turn, a failed session open, and the route skeleton itself.

### Files in this step

- `apps/web/components/teaching/lesson-workspace.tsx`
- `apps/web/components/teaching/lesson-workspace.spec.tsx`
- `apps/web/components/teaching/lesson-experience.tsx`
- `apps/web/components/teaching/lesson-experience.spec.tsx`
- `apps/web/lib/copy.ts`
- `docs/product/premium-ux-audit.md`

No dependency. No schema or migration.

### Checks after the lesson workspace

`EXECUTION_MODE=fake pnpm test --concurrency=1` with the local environment loaded: 20/20 tasks, exit 0. Fresh: web build and web tests. Web tests: 32 files, 71 passed, 0 skipped. Cached logs: config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, ai 80, api 111. Reported total: 488 passed, 0 skipped.

`pnpm lint`: 11/11, exit 0. Web lint executed; the other 10 were cache hits. `pnpm typecheck`: 22/22, exit 0. Web typecheck executed; the other 21 were cache hits. `NODE_ENV=production pnpm build`: 11/11, exit 0, replaying web compile hash `619987d4ce756fab`, compiled in 2.9s. `/app/learn/[lessonSlug]` is in the route list.

### Still open after this step

- A distinct secondary text color, only after a contrast check.
- Auth field fill.
- A live lesson with several teacher turns, so the “Əvvəlki izahlar” disclosure is seen in the browser. It is covered by the workspace test.

## 14. Exercise input selection, 10 October 2026

### Rule

`answerSurface` in `apps/web/components/exercises/editor-language.ts` chooses the control. The source fields are the exercise view the client already receives: `type`, `language`, and `executionAvailable`. The hidden answer and the length of `starterCode` are not inputs.

- `type === "multiple_choice"` → choice. The existing radios. Language is ignored.
- `type === "code_text"` and `language` is `null` or missing and `executionAvailable === false` → compact text. This is the authored text check used by curriculum helpers that set `language: null` and no execution config.
- `language` is `html`, `css`, or `javascript` → Monaco, including when execution is off. HTML and CSS structure checks stay in the editor.
- Anything else stays on Monaco. That includes an unknown type, an unknown language, `executionAvailable: true` with no language, and a legacy object that omits `executionAvailable`. Missing metadata is not treated as a short answer.

### What each format shows

Compact text: a labeled textarea, “Cavab”, at least two rows and at most six, growing with newline count. Minimum height 44px. The text wraps. There is no Run button. “Kod icrası bu mərhələdə aktiv deyil.” still shows for `code_text` when execution is off, including this field.

Monaco: the existing editor, language, height (`min(52dvh, 28rem)`, at least 320px), and the existing execution sentence. An exercise with execution keeps “Yoxlamalar serverdə, ayrı icra mühitində aparılır. Kod brauzerdə işlədilmir.” It does not show the inactive sentence.

Choice: the existing fieldset. No textarea and no Monaco.

Git and testing practice pages render the same board, so a language-null text exercise there uses the compact field. Their page logic was not edited.

### Submission

The check button, payload `{ clientAttemptId, submission }`, pending lock, score, and feedback are unchanged. The server remains the authority. Switching the control does not add a request.

### Accessibility and responsive behavior

The textarea name is “Cavab”. It is a real text control, so it takes keyboard input and works at 390px. Focus uses the existing `focus-visible` outline. Long answers use `whitespace-pre-wrap` and `overflow-x: hidden`, so a long line wraps instead of widening the page. The value stays in component state across a viewport change. Loading, disabled, success, and error copy are the existing strings. The reset control still says “Başlanğıc koduna qaytar”.

### Browser, 10 October 2026

Production web on port 3010. API live health returned 200. A new verified student signed in and skipped assessment, then opened `/app/learn/how-the-web-delivers-a-page`.

“Üç addım” (`code_text`, `language: null`, execution off) showed the compact field: label “Cavab”, 2 rows, height 74px, badge “Mətn · Başlanğıc”, and “Kod icrası bu mərhələdə aktiv deyil.” No Monaco node. A wrong answer “yalnız bir söz” returned server copy “Keçmədi”, result 0, attempt 1, and the stored feedback. The corrected answer returned “Düzgün · 100” on attempt 2. The field kept its value while “Yoxlanır...” was showing, and across 390, 768, 1024, 1280, and 1440. A long single line did not increase page scroll width.

“HTTP sorğusu” stayed four radios. No textarea and no Monaco. The selected option returned “Düzgün” and result 100. The checklist also prints the rule’s stored feedback, which is worded as a correction. That text comes from the existing result view.

“İki ədədi topla” (`language: "javascript"`, execution on) opened Monaco at about 390px and, at a taller viewport, 448px. The badge was “JavaScript · Başlanğıc”. The starter `function add` was visible. The notice was the server-execution sentence, not the inactive sentence. No Run button. No answer was submitted, so this pass does not claim the function ran.

Scroll width matched the viewport at 390, 768, 1024, 1280, and 1440 in light and in dark. Light at 1440: paper `rgb(247, 246, 242)`, ink `rgb(32, 32, 29)`. Dark: canvas `rgb(17, 17, 15)`, ink `rgb(243, 241, 234)`, enabled “Yoxla” fill `rgb(88, 101, 216)` with white text. “Yoxla” is 44px tall. The following lesson stayed “Bağlıdır”, so the HTML exercise on `html-text` was not opened. The keyboard focus ring was not painted. Pointer focus does not match `:focus-visible`.

### Files in this step

- `apps/web/components/exercises/editor-language.ts`
- `apps/web/components/exercises/editor-language.spec.ts`
- `apps/web/components/exercises/exercise-board.tsx`
- `apps/web/components/exercises/exercise-board.spec.tsx`
- `apps/web/lib/copy.ts`
- `docs/product/premium-ux-audit.md`

No dependency. No schema or migration. No change to scoring, idempotency, mastery, curriculum order, teaching turns, auth, or the sandbox.

### Checks, 10 October 2026

Focused board and language tests, then the full suite. `EXECUTION_MODE=fake pnpm test --concurrency=1` with the local environment loaded: 20/20 tasks, exit 0. Fresh: web build and web tests. Web tests: 32 files, 75 passed, 0 skipped. The other 18 test tasks were turbo cache hits whose logs report config 23, validation 29, execution 7, curriculum 141, runner 15, database 11, ai 80, api 111. Reported total: 492 passed, 0 skipped. A focused run of the six exercise, git, and testing files passed 21 tests before that suite.

`pnpm lint`: 11/11, exit 0. Web lint executed (hash `26976b2a573bc5ba`); the other 10 were cache hits. `pnpm typecheck`: 22/22, exit 0. Web typecheck executed (hash `69403ae15e0c089e`); the other 21 were cache hits. `NODE_ENV=production pnpm build`: 11/11, exit 0, full cache, replaying web compile hash `55a98feec9163e92` (compile 1913ms, TypeScript 1672ms). `/app/learn/[lessonSlug]` is in the route list.

### Still open

- The reset label on a text answer still says “Başlanğıc koduna qaytar”.
- HTML and CSS Monaco lessons were not opened. The next lesson was locked. JavaScript Monaco on the first lesson was opened and not submitted.
- Git and testing pages were not opened in the browser. They use the same board.
- The painted focus ring was not captured.
- A distinct secondary text color, only after a contrast check.
- Auth field fill.
