# TaskFlow project experience

TaskFlow is the existing published project with eight milestones. This page describes how a student meets that project. It does not add a second project engine.

## Architecture

Eligibility, milestone order, files, scoring, and completion stay on the server. The page at `/app/projects/taskflow` renders `ProjectDetail`. A locked milestone arrives without files. The client cannot mark a milestone passed.

The same workspace is used for every published project. TaskFlow is labeled “Real frontend layihəsi” because that is the project the student is building. Other projects use their difficulty band.

## What the student sees

The header names the project, the current milestone, the concepts already attached to the project, and the estimated minutes stored on the project. “Layihəyə davam et” moves to the current milestone.

The current milestone states its objective and the instructions the server will check. The workspace is the existing three files and editor. “Yoxla” submits those files. The reply shows what passed and what still needs attention. It does not lead with a score.

The milestone list uses words: Tamamlandı, İndi, Hələ açılmayıb, Düzəliş lazımdır. A locked row cannot be opened. The next locked title is named, with the sentence that it opens after the previous milestone is complete.

## Mentor

The mentor is the existing review API. After a failed check the student can ask for an explanation or a hint. After a pass they can ask for a review. The plan discussion is the same advisory plan review as before. Neither call changes milestone state.

## Completion

When every milestone is passed, the page says the project is complete, marks it as a portfolio project, and shows the portfolio record the server already builds. A link goes to the existing achievements page. The first-project achievement is still derived there. This page does not award it.

## Learning

If the student is not eligible and has not started, the project is absent. The project list explains that the work opens after the HTML lessons. The dashboard shows a project only when one is available. An unfinished project shows the current milestone title and “Layihəyə davam et”. A finished project shows “Tamamlanıb” and “Layihəyə bax”. It does not show an empty project block or a progress bar.

## Security

Project reads and writes require a verified session. A locked milestone submission is rejected by the existing project API. Direct navigation stays on `/app/projects/[slug]`; there is no client route that opens a locked milestone’s files.
