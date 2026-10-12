"use client";

import { useRef, useState } from "react";
import type { CodeReviewMode, CodeReviewResponse, ProjectAttemptView } from "@platform/types";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

export function ProjectReviewPanel({
  projectSlug,
  attempt,
}: {
  projectSlug: string;
  attempt: ProjectAttemptView;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<CodeReviewResponse["review"] | null>(null);
  const pendingRef = useRef(false);

  async function ask(mode: CodeReviewMode): Promise<void> {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const body = await apiPost<CodeReviewResponse>(
        `/api/v1/projects/${projectSlug}/milestones/${attempt.milestoneSlug}/review`,
        { attemptId: attempt.id, clientReviewId: createClientTurnId(), mode },
      );
      setReview(body.review);
    } catch (caught) {
      setError(
        caught instanceof NetworkError
          ? copy.errors.network
          : isApiError(caught)
            ? caught.message
            : copy.errors.generic,
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">{copy.projects.mentor}</h3>
      <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
        {copy.projects.mentorWait}
      </p>
      <div className="flex flex-wrap gap-2">
        {attempt.passed ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={pending}
            onClick={() => void ask("review")}
          >
            {copy.projects.reviewCode}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => void ask("explain")}
            >
              {copy.projects.explain}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => void ask("hint")}
            >
              {copy.projects.hint}
            </Button>
          </>
        )}
      </div>
      {pending ? (
        <p className="text-sm text-muted-foreground">{copy.exercise.reviewThinking}</p>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {review !== null ? (
        <section className="grid min-w-0 gap-3" aria-label={copy.projects.mentor}>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.summary}</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.feedback}</p>
          {review.strengths.length > 0 ? (
            <div className="grid gap-1">
              <h4 className="text-sm font-medium">{copy.projects.works}</h4>
              <ul className="grid gap-1">
                {review.strengths.map((item) => (
                  <li key={item} className="break-words text-sm leading-6 text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.issues.length > 0 ? (
            <div className="grid gap-1">
              <h4 className="text-sm font-medium">{copy.projects.attention}</h4>
              <ul className="grid gap-1">
                {review.issues.map((issue) => (
                  <li
                    key={`${issue.type}-${issue.description}`}
                    className="break-words text-sm leading-6 text-muted-foreground"
                  >
                    {issue.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.hint !== undefined ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.hint}</p>
          ) : null}
          {review.nextQuestion !== undefined ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {review.nextQuestion}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
