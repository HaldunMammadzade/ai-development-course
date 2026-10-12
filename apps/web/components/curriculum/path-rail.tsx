import Link from "next/link";
import type { PathConceptMark, PersonalizedPath } from "@platform/types";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";

const markLabel: Record<PathConceptMark, string> = {
  current: copy.path.current,
  known: copy.path.known,
  upcoming: copy.path.upcoming,
  review: copy.path.review,
};

export function PathRail({
  path,
  emphasis = false,
}: {
  path: PersonalizedPath;
  emphasis?: boolean;
}) {
  return (
    <section className="grid min-w-0 max-w-full gap-4" aria-labelledby="personalized-path-heading">
      <h2
        id="personalized-path-heading"
        className={
          emphasis
            ? "text-base font-medium text-foreground"
            : "text-sm font-medium text-muted-foreground"
        }
      >
        {copy.learn.title}
      </h2>
      {path.note !== null ? <p className="max-w-[65ch] text-sm leading-6">{path.note}</p> : null}
      {path.current !== null ? (
        <p className="text-sm">
          <span className="text-muted-foreground">{copy.learn.current}</span>
          <Link
            href={lessonHref(path.current.slug)}
            className="ml-2 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {path.current.title}
          </Link>
        </p>
      ) : null}
      {path.concepts.length > 0 ? (
        <ol className="grid min-w-0 gap-2">
          {path.concepts.map((concept) => (
            <li
              key={concept.slug}
              className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
              aria-current={concept.mark === "current" ? "step" : undefined}
            >
              <span className="text-muted-foreground">{markLabel[concept.mark]}</span>
              <span className={concept.mark === "current" ? "font-medium" : undefined}>
                {concept.name}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {path.next.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{copy.path.next}</h3>
          <ol className="grid gap-1 text-sm">
            {path.next.map((step) => (
              <li key={step.slug} className="min-w-0 break-words">
                <span className="text-muted-foreground">{copy.path.upcoming}</span> {step.title}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {path.known.length > 0 ? (
        <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
          {copy.assessment.known}: {path.known.join(", ")}
        </p>
      ) : null}
    </section>
  );
}
