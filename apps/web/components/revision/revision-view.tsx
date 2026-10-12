import Link from "next/link";
import type { RevisionQueue } from "@platform/types";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";

export function RevisionView({ queue }: { queue: RevisionQueue }) {
  return (
    <div className="grid w-full max-w-3xl min-w-0 gap-8">
      <header>
        <h1 className="font-serif text-4xl tracking-tight">{copy.revision.title}</h1>
        <p className="mt-3 max-w-[65ch] leading-7 text-muted-foreground">{copy.revision.lead}</p>
      </header>
      {queue.status === "empty" ? (
        <div className="grid gap-2">
          <p className="text-sm leading-6">{copy.revision.empty}</p>
          <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
            {copy.revision.emptyBody}
          </p>
        </div>
      ) : null}
      {queue.status === "waiting" ? (
        <p className="text-sm leading-6">{copy.revision.waiting}</p>
      ) : null}
      {queue.status === "reviewed" ? (
        <p className="text-sm leading-6">{copy.revision.reviewed}</p>
      ) : null}
      {queue.status === "ready" ? (
        <section className="grid gap-4" aria-labelledby="revision-today">
          <h2 id="revision-today" className="text-sm font-medium text-muted-foreground">
            {copy.revision.today}
          </h2>
          <p className="text-sm leading-6">{copy.revision.ready(queue.items.length)}</p>
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {queue.items.map((item, index) => (
              <li key={item.slug} className="grid min-w-0 gap-2 py-5">
                <h3 className="break-words text-base font-medium">{item.name}</h3>
                <p className="text-sm leading-6">{copy.revision.states[item.state]}</p>
                <p className="text-sm leading-6 text-muted-foreground">{copy.revision.reason}</p>
                <Link
                  href={lessonHref(item.lessonSlug)}
                  className={
                    index === 0
                      ? "inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground"
                      : "inline-flex min-h-11 w-fit items-center text-sm font-medium text-[var(--color-text-link)] underline-offset-4 hover:underline"
                  }
                >
                  {copy.revision.start}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
