# Testing fundamentals

Status: implemented as an optional practice module on the existing frontend path.

Date: 9 October 2026.

Testing Fundamentals teaches how a frontend developer checks behavior. It reuses the curriculum, authored exercises, mastery, revision, and personalized path. It does not add a second exercise engine, a new mastery formula, or a test runner for student code.

## Curriculum

The module slug is `testing`. It is position 9 on the published frontend path, after Git. There are 9 lessons and 14 concepts:

1. Why tests exist, and the difference between expected and actual results.
2. Assertions, including `expect(add(2, 3)).toBe(5)`.
3. Unit tests and edge cases, including an empty TaskFlow list.
4. Component rendering and a user interaction.
5. Integration tests and an end-to-end workflow. Not every test opens a browser.
6. Mocks, isolation, and a brittle check.
7. Reading a failing assertion and correcting the expected result.
8. Regression, and why coverage does not prove the absence of every bug.
9. Placing that check in the existing change sequence, using a TaskFlow filter scenario.

Prerequisites stay inside the module. `testing.purpose` has none, so the first lesson can be practiced immediately. Each later concept depends on an earlier testing concept. The graph is a DAG. Testing is not a prerequisite of React, Next.js, TaskFlow, or Git, so it does not block those lessons.

`getNextAction` is unchanged. For a student who still has an earlier uncredited lesson, that lesson stays the next action. The catalog marks an unlocked testing lesson as `practice` instead of `current`. A locked testing lesson stays locked until the existing mastery threshold is met.

## Exercises

There are 16 authored exercises. Types are the existing `multiple_choice` and `code_text` checks. Every exercise has `execution: null`. The isolated runner does not start, and no student test file is executed on the API host.

The exercises ask the student to identify an expected result, write one assertion, name an edge case, tell a unit test from an integration test, choose what to mock, spot a brittle check, correct a failing assertion, recognize a regression, and read a coverage claim carefully. Two of them use a TaskFlow status filter as a scenario: an empty list, and a missing empty-list case. Those are conceptual. They are not a test run against the TaskFlow repository.

A command-shaped answer such as `npm test; rm -rf /` is only text. It fails the authored rule and writes no mastery.

The attempt body remains the strict object: a client attempt id and a submission. `score` and `passed` are rejected. The same client attempt id returns the stored result. Rate limits are unchanged.

## Mastery and the path

Opening `/app/testing` reads the catalog and, when the lesson is open, its exercises. It does not write mastery and it does not start a teaching session.

A passing submission uses `exerciseMasteryUpdate` and the existing learning event. A failing submission writes no evidence. An unknown testing concept stays unknown until that evidence exists.

Revision can offer a testing exercise only after a real success, through the existing schedule. Achievements are not extended. There is no testing badge. The dashboard is unchanged. When a testing lesson becomes the server’s next action, the existing hero already shows it.

The practice page links to the teaching lesson only when that lesson is the server’s current action. Until then the page says the teacher is not running this step.

## Git and TaskFlow

The page states the professional sequence: change the code, write a test, run it, read the failure, fix the code or the test, run it again, review the diff, then commit. It uses the existing Git lessons as the place that sequence is practiced. This page does not create a commit, a branch, or a CI run.

TaskFlow examples are the status filter, an empty list, invalid form feedback, completing a task, and an API error that should be mocked rather than called. They illustrate the idea. They do not change TaskFlow’s completion rules.

## Security

Student test code is not executed. The existing runner trust boundary, resource limits, and network restrictions are unchanged because this module does not call the runner. Unlock state, scores, and mastery stay on the server.
