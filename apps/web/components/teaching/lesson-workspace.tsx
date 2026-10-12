"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LindelMark } from "@/components/brand/lindel-mark";
import { TeacherMessage } from "@/components/teaching/teacher-message";
import { Button } from "@/components/ui/button";
import { IconCheck, IconLock } from "@/components/ui/icon";
import { copy } from "@/lib/copy";
import type { LessonPhase, LessonWorkspaceModel } from "@/lib/teaching/workspace";
import { cn } from "@/lib/utils";

export function LessonWorkspace({
  model,
  phase,
  pending,
  error,
  onAdvance,
  onRestart,
  composer,
  children,
}: {
  model: LessonWorkspaceModel;
  phase: LessonPhase;
  pending: boolean;
  error: string | null;
  onAdvance: () => void;
  onRestart: () => void;
  composer: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_22.5rem] xl:gap-12">
      <div className="grid min-w-0 gap-8">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="[font:var(--type-caption)] text-muted-foreground">
              {model.moduleTitle ?? model.pathTitle}
            </p>
            {model.position !== null ? (
              <p className="[font:var(--type-caption)] text-muted-foreground">{model.position}</p>
            ) : null}
          </div>
          <h1 className="[font:var(--type-display-lg)] tracking-tight">{model.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {model.stateLabel !== null ? <p>{model.stateLabel}</p> : null}
            {model.minutes !== null ? (
              <p>
                {model.minutes} {copy.teacher.minutesShort}
              </p>
            ) : null}
          </div>
          <LessonOutline model={model} />
        </header>

        {model.objective !== null ? (
          <section className="max-w-[65ch]" aria-labelledby="lesson-objective">
            <h2 id="lesson-objective" className="[font:var(--type-h3)] text-foreground">
              {copy.teacher.willLearn}
            </h2>
            <p className="mt-2 text-base leading-7">{model.objective}</p>
          </section>
        ) : null}

        <LessonBlock model={model} phase={phase} />
        <InlineTeacher model={model} />

        {model.answers.length > 0 ? (
          <div className="grid gap-4">
            {model.answers.map((speech, index) => (
              <TeacherMessage key={`answer-${index}`} role="student" speech={speech} />
            ))}
          </div>
        ) : null}

        {model.homeworkPrompt !== null ? (
          <section className="chapter max-w-[65ch]">
            <h2 className="text-sm font-medium">{copy.teacher.homeworkReady}</h2>
            <p className="mt-2 whitespace-pre-wrap leading-7">{model.homeworkPrompt}</p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.teacher.homeworkSeparate}</p>
          </section>
        ) : null}

        {model.adaptive !== null ? (
          <p className="max-w-[65ch] text-sm leading-6">{model.adaptive}</p>
        ) : null}

        {phase === "path_complete" && model.completion === null ? (
          <p>{copy.teacher.pathDone}</p>
        ) : null}
        {phase === "closed" ? (
          <div className="grid max-w-sm gap-3">
            <p>{copy.teacher.closed}</p>
            <Button onClick={onRestart}>{copy.teacher.restart}</Button>
          </div>
        ) : null}
        {error !== null ? (
          <div className="grid max-w-sm gap-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            {phase === "error" ? <Button onClick={onRestart}>{copy.retry}</Button> : null}
          </div>
        ) : null}

        {model.completion !== null ? (
          <Completion model={model} />
        ) : composer !== null || model.advance !== null ? (
          <div id="lesson-action" className="grid gap-4">
            {composer}
            {model.advance !== null ? (
              <div>
                <Button disabled={pending || phase !== "ready"} onClick={onAdvance}>
                  {pending ? copy.auth.working : model.advance}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {model.notice.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">{copy.teacher.updated}</p>
            <ul className="grid gap-1 text-sm">
              {model.notice.map((item) => (
                <li key={item.name}>
                  {item.name}. {item.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {children}
      </div>

      <aside className="hidden min-w-0 xl:sticky xl:top-6 xl:block xl:max-h-[calc(100dvh-4.5rem)] xl:overflow-y-auto">
        <TeacherPanel model={model} messages={model.teacherMessages} headingId="teacher-aside" />
      </aside>
    </div>
  );
}

function LessonOutline({ model }: { model: LessonWorkspaceModel }) {
  if (model.previous === null && model.current === null && model.next === null) {
    return null;
  }
  return (
    <details className="max-w-xl">
      <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {copy.teacher.outline}
      </summary>
      <ol className="grid gap-3 pb-2">
        <OutlineItem label={copy.teacher.previous} item={model.previous} />
        <OutlineItem label={copy.learn.current} item={model.current} here />
        <OutlineItem label={copy.teacher.next} item={model.next} />
      </ol>
      {model.concepts.length > 0 ? (
        <div className="grid gap-2 border-t border-border py-3">
          <h2 className="text-sm font-medium">{copy.teacher.concepts}</h2>
          <ul className="grid gap-2">
            {model.concepts.map((concept) => (
              <li key={concept.name} className="text-sm leading-6">
                <span className="font-medium">{concept.name}</span>
                <span className="text-muted-foreground">. {concept.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

function OutlineItem({
  label,
  item,
  here = false,
}: {
  label: string;
  item: LessonWorkspaceModel["next"];
  here?: boolean;
}) {
  if (item === null) {
    return null;
  }
  return (
    <li className="grid gap-1 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {item.availability === "completed" ? (
          <IconCheck className="size-3.5 text-success" />
        ) : item.availability === "locked" ? (
          <IconLock className="size-3.5" />
        ) : (
          <span className="size-1.5 bg-primary" aria-hidden="true" />
        )}
        {label}
      </span>
      {item.href !== null ? (
        <Link
          href={item.href}
          className="inline-flex min-h-11 items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {item.title}
        </Link>
      ) : (
        <span className={cn("font-medium", here ? "text-foreground" : "")}>{item.title}</span>
      )}
      <span className="text-muted-foreground">
        {here ? copy.teacher.here : item.status}
        {item.lockedReason !== null ? `. ${item.lockedReason}` : ""}
      </span>
    </li>
  );
}

function LessonBlock({ model, phase }: { model: LessonWorkspaceModel; phase: LessonPhase }) {
  if (phase === "loading") {
    return null;
  }
  const block = model.block;
  if (block === null) {
    return null;
  }
  if (block.kind === "reading") {
    return (
      <section className="grid max-w-[65ch] gap-4" aria-labelledby="lesson-reading">
        <h2 id="lesson-reading" className="[font:var(--type-h3)] text-foreground">
          {block.label}
        </h2>
        {block.paragraphs.map((paragraph, index) =>
          paragraph.code ? (
            <pre
              key={`code-${index}`}
              className="overflow-x-auto bg-[var(--color-bg-code)] p-3 font-mono text-sm leading-6"
            >
              {paragraph.text}
            </pre>
          ) : (
            <p
              key={`text-${index}`}
              className="whitespace-pre-wrap break-words text-base leading-7"
            >
              {paragraph.text}
            </p>
          ),
        )}
      </section>
    );
  }
  if (block.kind === "question") {
    return (
      <section className="max-w-[65ch]" aria-labelledby="lesson-check">
        <h2 id="lesson-check" className="[font:var(--type-h3)] text-foreground">
          {block.label}
        </h2>
        <p className="mt-3 break-words text-base leading-7">{block.prompt}</p>
      </section>
    );
  }
  return (
    <section className="grid max-w-[65ch] gap-3" aria-labelledby="lesson-recap">
      <h2 id="lesson-recap" className="[font:var(--type-h3)] text-foreground">
        {block.label}
      </h2>
      <ul className="grid list-disc gap-2 pl-5 text-base leading-7">
        {block.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {block.practice.length > 0 ? (
        <p className="leading-7">
          <span className="font-medium">{copy.teacher.practice}. </span>
          {block.practice}
        </p>
      ) : null}
    </section>
  );
}

function Completion({ model }: { model: LessonWorkspaceModel }) {
  const completion = model.completion;
  if (completion === null) {
    return null;
  }
  return (
    <section className="chapter grid max-w-[65ch] gap-3" aria-labelledby="lesson-complete">
      <h2 id="lesson-complete" className="flex items-center gap-2 text-lg font-medium">
        <IconCheck className="size-4 text-success" />
        {completion.title}
      </h2>
      {completion.learned !== null ? (
        <p className="leading-7">
          <span className="font-medium">{copy.teacher.learned}. </span>
          {completion.learned}
        </p>
      ) : null}
      {completion.concepts.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {completion.concepts.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
      {completion.body !== null ? <p className="text-sm leading-6">{completion.body}</p> : null}
      {completion.href !== null && completion.label !== null ? (
        <>
          <p className="text-sm font-medium">{copy.teacher.nextStep}</p>
          <Link
            id="lesson-action"
            href={completion.href}
            className="inline-flex min-h-11 w-fit items-center bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {completion.label}
          </Link>
        </>
      ) : null}
    </section>
  );
}

function InlineTeacher({ model }: { model: LessonWorkspaceModel }) {
  const latest = model.teacherMessages.at(-1);
  const earlier = model.teacherMessages.slice(0, -1);
  return (
    <section className="grid min-w-0 max-w-[65ch] gap-4 xl:hidden" aria-labelledby="teacher-inline">
      <TeacherPanel
        model={model}
        messages={latest === undefined ? [] : [latest]}
        headingId="teacher-inline"
      />
      {earlier.length > 0 ? (
        <details className="grid gap-3">
          <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {copy.teacher.earlierTurns}
          </summary>
          <div className="grid gap-4 pt-2">
            {earlier.map((speech, index) => (
              <TeacherMessage key={`earlier-${index}`} role="teacher" speech={speech} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function TeacherPanel({
  model,
  messages,
  headingId,
}: {
  model: LessonWorkspaceModel;
  messages: string[];
  headingId: string;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex items-center gap-2">
        <LindelMark className="size-4" />
        <h2 id={headingId} className="[font:var(--type-h3)] text-foreground">
          {copy.teacher.label}
        </h2>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {model.teacherLabel}
      </p>
      {messages.length === 0 ? null : (
        <div className="grid gap-4">
          {messages.map((speech, index) => (
            <TeacherMessage key={`${headingId}-${index}`} role="teacher" speech={speech} />
          ))}
        </div>
      )}
    </div>
  );
}
