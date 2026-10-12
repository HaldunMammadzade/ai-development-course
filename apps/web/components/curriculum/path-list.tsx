import Link from "next/link";
import type { LearningCatalog } from "@platform/types";
import { PathRail } from "@/components/curriculum/path-rail";
import { IconCheck, IconLock } from "@/components/ui/icon";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";
import { cn } from "@/lib/utils";

export function PathList({ catalog }: { catalog: LearningCatalog }) {
  if (catalog.path === null || catalog.modules.length === 0) {
    return <p className="text-muted-foreground">{copy.learn.empty}</p>;
  }

  return (
    <div className="grid max-w-3xl gap-10">
      <header>
        <p className="text-sm font-medium text-primary">{catalog.path.title}</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{copy.learn.title}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{catalog.path.description}</p>
        {catalog.focus !== null ? (
          <p className="mt-4 max-w-2xl text-sm leading-6">
            <span className="font-semibold">{copy.dashboard.focus}: </span>
            {catalog.focus.name}.{" "}
            {copy.adaptive[catalog.focus.reason as keyof typeof copy.adaptive] ??
              copy.adaptive.baseline}
          </p>
        ) : null}
      </header>
      {catalog.personalized !== undefined ? <PathRail path={catalog.personalized} /> : null}
      <div className="grid gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">{copy.learn.modules}</h2>
        {catalog.modules.map((module) => {
          const open = module.lessons.some((lesson) => lesson.availability === "current");
          return (
            <details
              key={module.slug}
              open={open}
              className="min-w-0 border-t border-[var(--color-border-subtle)] pt-3"
            >
              <summary className="flex min-h-11 cursor-pointer items-center font-serif text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {module.title}
              </summary>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{module.description}</p>
              <ol className="mt-3 grid gap-2">
                {module.lessons.map((lesson) => {
                  const current = lesson.availability === "current";
                  const completed = lesson.availability === "completed";
                  const practice = lesson.availability === "practice";
                  const href = practice
                    ? module.slug === "git"
                      ? "/app/git"
                      : module.slug === "testing"
                        ? "/app/testing"
                        : lessonHref(lesson.slug)
                    : lessonHref(lesson.slug);
                  return (
                    <li
                      key={lesson.slug}
                      className={cn(
                        "border-b border-[var(--color-border-subtle)] py-4",
                        current && "bg-accent px-3",
                        !current && "text-muted-foreground",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {completed ? (
                              <IconCheck className="size-3.5 text-success" />
                            ) : current || practice ? (
                              <span className="size-1.5 rounded-full bg-primary" />
                            ) : (
                              <IconLock className="size-3.5" />
                            )}
                            {availabilityLabel(lesson.availability)}
                          </p>
                          <h3
                            className={cn(
                              "mt-2 text-lg font-semibold",
                              current || completed || practice ? "text-foreground" : "",
                            )}
                          >
                            {lesson.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6">{lesson.objective}</p>
                        </div>
                        {current || practice ? (
                          <Link
                            href={href}
                            className={cn(
                              "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              current
                                ? "bg-primary text-primary-foreground"
                                : "text-primary underline-offset-4 hover:underline",
                            )}
                          >
                            {practice ? copy.learn.practice : copy.learn.open}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function availabilityLabel(availability: "completed" | "current" | "practice" | "locked"): string {
  if (availability === "completed") {
    return copy.learn.completed;
  }
  if (availability === "current") {
    return copy.learn.current;
  }
  if (availability === "practice") {
    return copy.learn.practice;
  }
  return copy.learn.locked;
}
