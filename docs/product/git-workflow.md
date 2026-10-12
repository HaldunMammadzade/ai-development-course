# Git and GitHub workflow

Status: implemented as an optional practice module on the existing frontend path.

Date: 8 October 2026.

Git is a learning track, not a dependency of Lindel. A student can finish TaskFlow and the rest of the path without GitHub. This step does not connect a GitHub account, store a token or password, or call the GitHub API.

## Architecture

The module slug is `git`. It is position 8 on the published frontend path, after Next.js. Lessons, concepts, prerequisites, and exercises are authored in the existing curriculum document and scored by the existing exercise evaluator.

`getNextAction` is unchanged. It still returns the first uncredited unlocked lesson in path order. For a new student that remains the first web lesson. The first Git lesson has no earlier prerequisite, so the catalog marks it `practice` instead of `current`. Later Git lessons stay `locked` until the existing mastery threshold is met for the earlier Git concept. The client cannot set that state.

`practice` means the lesson can be read and its exercises can be submitted. It does not replace the path’s current lesson and it does not start a teaching session by itself. The existing teacher opens only when that lesson is the server’s next action. Until then the Git page says the teacher is not running this step.

Opening `/app/git` only reads the catalog and the lesson’s exercises. It writes no mastery.

## What the student practices

The sequence is repository and working tree, diff and staging, commit and history, branch and merge, a controlled merge conflict, remote push/fetch/pull, then a pull request and a review response. The scenario is a TaskFlow status filter on `feature/task-filter`. The page says this is not a real Git or GitHub operation.

Every exercise is `multiple_choice` or `code_text`. None has an execution config, so the runner never starts and no shell command reaches the host. A submission such as `git add .; rm -rf /` is only text. It fails the authored rules.

The conflict exercise starts from the two title assignments and the conflict markers. The accepted resolution is the single line `const title = "TaskFlow";`. Markers left in the answer fail.

A commit message must name the work. `update` fails. `Add task filtering` passes. There is no conventional-commits parser.

## Mastery and the rest of the learning system

A passing submission uses `exerciseMasteryUpdate` and the existing learning event. A failing submission, including a shell-looking string, writes no evidence. Unknown Git concepts stay unknown until that evidence exists.

The skill map shows the new concepts through the existing graph. Revision can offer an exercise for a Git concept only after real success, and only through the existing schedule. Achievements are not extended. There is no Git badge.

The dashboard is unchanged. When a Git lesson becomes the server’s next action, the existing hero already shows it. There is no extra Git card.

## Security

The attempt body is the existing strict object: a client attempt id and a submission. `score` and `passed` are rejected. Lesson unlock and exercise results stay on the server. No personal GitHub credential is accepted or stored.

## Navigation

Git & GitHub sits under Təcrübə, next to Layihə, at `/app/git`. The workflow is vertical on a narrow screen and a wrapping row from the large breakpoint. Status is a word: Məşq, İndi, Tamamlandı, or Hələ açılmayıb.
