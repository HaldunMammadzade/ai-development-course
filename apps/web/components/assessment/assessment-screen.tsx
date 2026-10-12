import type { AssessmentView, PersonalizedPath } from "@platform/types";
import Link from "next/link";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { PathRail } from "@/components/curriculum/path-rail";
import { Progress } from "@/components/ui/progress";
import { copy } from "@/lib/copy";

export function AssessmentScreen({
  view,
  route = null,
}: {
  view: AssessmentView;
  route?: PersonalizedPath | null;
}) {
  if (view.status === "completed" && view.result !== null) {
    const lesson = route?.current ?? view.result.lesson;
    const known = route !== null ? route.known.map((name) => ({ name })) : view.result.known;
    return (
      <article className="mx-auto grid w-full max-w-2xl gap-8">
        <header className="grid gap-2">
          <p className="text-sm text-muted-foreground">{view.result.label}</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {copy.assessment.resultTitle}
          </h1>
          {lesson !== null ? (
            <p className="text-base">
              {lesson.moduleTitle}
              <span className="text-muted-foreground"> · {lesson.title}</span>
            </p>
          ) : null}
        </header>
        <section className="grid gap-2" aria-labelledby="assessment-known">
          <h2 id="assessment-known" className="text-sm font-medium">
            {copy.assessment.known}
          </h2>
          {known.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.assessment.emptyKnown}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {known.map((concept) => (
                <li key={concept.name}>{concept.name}</li>
              ))}
            </ul>
          )}
        </section>
        {route !== null ? <PathRail path={route} /> : null}
        <section className="grid gap-2" aria-labelledby="assessment-gaps">
          <h2 id="assessment-gaps" className="text-sm font-medium">
            {copy.assessment.gaps}
          </h2>
          {view.result.gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.assessment.emptyGaps}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {view.result.gaps.map((concept) => (
                <li key={concept.name}>
                  {concept.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {concept.weak ? copy.dashboard.weakStatus : copy.assessment.gap}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">{copy.assessment.notAssessed}</p>
        </section>
        {lesson !== null ? (
          <Link
            href={`/app/learn/${lesson.slug}`}
            className="inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {copy.assessment.start}
          </Link>
        ) : null}
      </article>
    );
  }

  const position = Math.min(view.limit, view.answered + 1);
  return (
    <article className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="grid gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {copy.assessment.title}
        </h1>
        <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
          {copy.assessment.lead}
        </p>
        <p className="text-sm">
          {copy.assessment.progress} {position} {copy.assessment.of} {view.limit}
        </p>
        <Progress
          value={position}
          max={view.limit}
          label={copy.assessment.progress}
          valueText={`${position} ${copy.assessment.of} ${view.limit}`}
        />
      </header>
      {view.item !== null ? <AssessmentForm view={view} /> : null}
    </article>
  );
}
