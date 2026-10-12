import type { ExerciseAttemptView } from "@platform/types";
import { IconCheck } from "@/components/ui/icon";
import { copy } from "@/lib/copy";

export function ExerciseResult({
  result,
  retry = copy.exercise.retry,
}: {
  result: ExerciseAttemptView;
  retry?: string;
}) {
  const passed = result.passed;
  return (
    <div
      role="status"
      data-result={passed ? "passed" : "failed"}
      className={
        passed
          ? "grid gap-2 border border-border border-l-2 border-l-[var(--color-success)] bg-card p-3"
          : "grid gap-2 border border-border border-l-2 border-l-[var(--color-warning)] bg-card p-3"
      }
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {passed ? <IconCheck className="size-4 text-success" /> : null}
        {passed ? copy.exercise.passed : copy.exercise.notPassed}
        <span className="sr-only">.</span>
      </p>
      <p className="break-words text-sm leading-6">{result.feedback}</p>
      <p className="text-sm text-muted-foreground">
        {copy.exercise.score}: {result.score}
        {" · "}
        {copy.exercise.attempt} {result.attemptNumber}
      </p>
      {passed ? <p className="text-sm">{copy.exercise.updated}</p> : null}
      {passed ? (
        <a
          href="#lesson-action"
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {copy.exercise.continueLesson}
        </a>
      ) : (
        <p className="text-sm leading-6">{retry}</p>
      )}
      {result.passedRules.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {result.passedRules.map((rule) => (
            <li key={`passed-${rule.feedback}`}>
              {copy.exercise.passedCheck}: {rule.feedback}
            </li>
          ))}
        </ul>
      ) : null}
      {result.failedRules.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {result.failedRules.map((rule) => (
            <li key={`failed-${rule.feedback}`}>
              {copy.exercise.failedCheck}: {rule.feedback}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
