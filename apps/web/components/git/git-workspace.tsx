import Link from "next/link";
import type { ExerciseView, LessonAvailability } from "@platform/types";
import { ExerciseBoard } from "@/components/exercises/exercise-board";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";
import { cn } from "@/lib/utils";

const steps = [
  {
    lesson: "git-repository",
    name: "Dəyişiklik",
    explanation: "İş ağacında fayl dəyişir. Bu hələ tarixçə deyil.",
  },
  {
    lesson: "git-changes",
    name: "Baxış",
    explanation: "Diff nəyin dəyişdiyini göstərir.",
  },
  {
    lesson: "git-changes",
    name: "Seçim",
    explanation: "Commit-ə yalnız hazır dəyişiklik düşür.",
  },
  {
    lesson: "git-commits",
    name: "Commit",
    explanation: "Seçilmiş iş bir mesajla saxlanır.",
  },
  {
    lesson: "git-branches",
    name: "Branch",
    explanation: "İş əsas xətdən ayrı aparılır.",
  },
  {
    lesson: "git-remote",
    name: "Push",
    explanation: "Commit ortaq nüsxəyə göndərilir.",
  },
  {
    lesson: "git-pull-request",
    name: "Pull request",
    explanation: "Dəyişiklik birləşməzdən əvvəl təklif olunur.",
  },
  {
    lesson: "git-pull-request",
    name: "Review",
    explanation: "Başqası koda baxır və rəy yazır.",
  },
  {
    lesson: "git-branches",
    name: "Merge",
    explanation: "Qəbul olunmuş iş əsas xəttə qayıdır.",
  },
] as const;

export function GitWorkspace({
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
    <div className="grid w-full max-w-3xl gap-10">
      <header className="grid gap-3">
        <h1 className="font-serif text-4xl tracking-tight">{copy.git.title}</h1>
        <p className="max-w-2xl leading-7 text-muted-foreground">{copy.git.lead}</p>
        <p className="max-w-2xl text-sm leading-6">{copy.git.taskflow}</p>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.git.sandbox}</p>
      </header>

      <section className="grid gap-3" aria-labelledby="git-workflow-heading">
        <h2 id="git-workflow-heading" className="text-sm font-medium text-muted-foreground">
          {copy.git.workflow}
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
        <section className="grid gap-3" aria-labelledby="git-lesson-heading">
          <h2 id="git-lesson-heading" className="text-sm font-medium text-muted-foreground">
            {copy.git.lesson}
          </h2>
          <h3 className="font-serif text-2xl">{active.title}</h3>
          <p className="text-sm font-medium">{stateLabel(active.availability)}</p>
          <p className="max-w-2xl leading-7">{active.objective}</p>
          {active.availability === "locked" ? (
            <p className="max-w-2xl leading-7 text-muted-foreground">{copy.git.locked}</p>
          ) : (
            reading.map((paragraph) => (
              <p key={paragraph} className="max-w-2xl leading-7">
                {paragraph}
              </p>
            ))
          )}
          {active.availability === "current" ? (
            <Link
              href={lessonHref(active.slug)}
              className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.git.openLesson}
            </Link>
          ) : active.availability === "practice" ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.git.teacher}</p>
          ) : null}
        </section>
      )}

      {exercises.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="git-practice-heading">
          <h2 id="git-practice-heading" className={cn("text-sm font-medium text-muted-foreground")}>
            {copy.git.practice}
          </h2>
          <ExerciseBoard exercises={exercises} />
        </section>
      ) : null}
    </div>
  );
}

function stateLabel(state: LessonAvailability): string {
  if (state === "completed") {
    return copy.git.stateDone;
  }
  if (state === "current") {
    return copy.git.stateCurrent;
  }
  if (state === "practice") {
    return copy.git.statePractice;
  }
  return copy.git.stateLocked;
}
