import Link from "next/link";
import type { ExerciseView, LessonAvailability } from "@platform/types";
import { ExerciseBoard } from "@/components/exercises/exercise-board";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";

const steps = [
  {
    lesson: "testing-why",
    name: "Vəd",
    explanation: "Test vəd edilən davranışı yoxlayır.",
  },
  {
    lesson: "testing-assertions",
    name: "Assertion",
    explanation: "Gözlənilən nəticə bir sətirlə yoxlanır.",
  },
  {
    lesson: "testing-unit",
    name: "İşlət",
    explanation: "Vahid test bir davranışı və kənar halı yoxlayır.",
  },
  {
    lesson: "testing-failures",
    name: "Uğursuzluq",
    explanation: "Faktiki nəticə gözləniləndən fərqlənəndə test dayanır.",
  },
  {
    lesson: "testing-regression",
    name: "Yenidən işlət",
    explanation: "Köhnə vəd yeni dəyişiklikdən sonra da qalmalıdır.",
  },
  {
    lesson: "testing-taskflow",
    name: "Commit",
    explanation: "Commit testdən sonra gəlir. Bu səhifə commit etmir.",
  },
] as const;

export function TestingWorkspace({
  lessons,
  active,
  reading,
  exercises,
}: {
  lessons: Array<{ slug: string; availability: LessonAvailability }>;
  active: {
    slug: string;
    title: string;
    objective: string;
    availability: LessonAvailability;
  } | null;
  reading: string[];
  exercises: ExerciseView[];
}) {
  const availability = new Map(lessons.map((lesson) => [lesson.slug, lesson.availability]));
  return (
    <div className="grid w-full min-w-0 max-w-3xl gap-10">
      <header className="grid gap-3">
        <h1 className="font-serif text-4xl tracking-tight">{copy.testing.title}</h1>
        <p className="max-w-2xl leading-7 text-muted-foreground">{copy.testing.lead}</p>
        <p className="max-w-2xl text-sm leading-6">{copy.testing.taskflow}</p>
        <p className="max-w-2xl text-sm leading-6">{copy.testing.git}</p>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.testing.sandbox}</p>
      </header>

      <section className="grid min-w-0 gap-3" aria-labelledby="testing-workflow-heading">
        <h2 id="testing-workflow-heading" className="text-sm font-medium text-muted-foreground">
          {copy.testing.workflow}
        </h2>
        <ol className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-4">
          {steps.map((step, index) => {
            const state = availability.get(step.lesson) ?? "locked";
            return (
              <li key={`${step.lesson}-${step.name}`} className="grid min-w-0 gap-1 lg:max-w-40">
                <p className="text-sm font-medium">
                  {index + 1}. {step.name}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">{step.explanation}</p>
                <p className="text-xs font-medium">{stateLabel(state)}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {active === null ? null : (
        <section className="grid min-w-0 gap-3" aria-labelledby="testing-lesson-heading">
          <h2 id="testing-lesson-heading" className="text-sm font-medium text-muted-foreground">
            {copy.testing.lesson}
          </h2>
          <h3 className="font-serif text-2xl">{active.title}</h3>
          <p className="text-sm font-medium">{stateLabel(active.availability)}</p>
          <p className="max-w-2xl leading-7">{active.objective}</p>
          {active.availability === "locked" ? (
            <p className="max-w-2xl leading-7 text-muted-foreground">{copy.testing.locked}</p>
          ) : (
            reading.map((paragraph) =>
              isCode(paragraph) ? (
                <pre
                  key={paragraph}
                  className="max-w-full overflow-x-auto rounded-md bg-card p-3 font-mono text-sm leading-6"
                >
                  <code>{paragraph}</code>
                </pre>
              ) : (
                <p key={paragraph} className="max-w-2xl leading-7">
                  {paragraph}
                </p>
              ),
            )
          )}
          {active.availability === "current" ? (
            <Link
              href={lessonHref(active.slug)}
              className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.testing.openLesson}
            </Link>
          ) : active.availability === "practice" ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy.testing.teacher}
            </p>
          ) : null}
        </section>
      )}

      {exercises.length > 0 ? (
        <section className="grid min-w-0 gap-3" aria-labelledby="testing-practice-heading">
          <h2 id="testing-practice-heading" className="text-sm font-medium text-muted-foreground">
            {copy.testing.practice}
          </h2>
          <ExerciseBoard exercises={exercises} />
        </section>
      ) : null}
    </div>
  );
}

function isCode(paragraph: string): boolean {
  return paragraph.startsWith("expect(") || paragraph.startsWith("const ");
}

function stateLabel(state: LessonAvailability): string {
  if (state === "completed") {
    return copy.testing.stateDone;
  }
  if (state === "current") {
    return copy.testing.stateCurrent;
  }
  if (state === "practice") {
    return copy.testing.statePractice;
  }
  return copy.testing.stateLocked;
}
