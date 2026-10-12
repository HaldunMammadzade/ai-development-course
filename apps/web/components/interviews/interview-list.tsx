import Link from "next/link";
import type { InterviewSummary } from "@platform/types";
import { copy } from "@/lib/copy";

export function InterviewList({ interviews }: { interviews: InterviewSummary[] }) {
  if (interviews.length === 0) {
    return (
      <div className="grid min-w-0 gap-3">
        <h1 className="font-serif text-3xl">{copy.interviews.title}</h1>
        <p className="break-words text-muted-foreground">{copy.interviews.empty}</p>
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-4">
      <header className="grid gap-2">
        <h1 className="font-serif text-3xl">{copy.interviews.title}</h1>
        <p className="break-words text-muted-foreground">{copy.interviews.lead}</p>
      </header>
      <ul className="grid min-w-0 gap-3">
        {interviews.map((interview) => (
          <li key={interview.slug} className="min-w-0">
            <Link
              href={`/app/interviews/${interview.slug}`}
              className="grid min-h-11 min-w-0 gap-1 border-b border-[var(--color-border-subtle)] py-4"
            >
              <span className="break-words font-medium">{interview.title}</span>
              <span className="break-words text-sm text-muted-foreground">
                {interview.description}
              </span>
              <span className="text-sm text-muted-foreground">
                {interview.questionCount} · {interview.estimatedMinutes} {copy.interviews.minutes}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
