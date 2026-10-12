"use client";

import { useRef, useState } from "react";
import type { CodeReviewMode, CodeReviewResponse, ExerciseAttemptView } from "@platform/types";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

export function CodeReviewPanel({
  exerciseId,
  attempt,
}: {
  exerciseId: string;
  attempt: ExerciseAttemptView;
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
      const body = await apiPost<CodeReviewResponse>(`/api/v1/exercises/${exerciseId}/review`, {
        attemptId: attempt.id,
        clientReviewId: createClientTurnId(),
        mode,
      });
      setReview(body.review);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap gap-2">
        {attempt.passed ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={pending}
            onClick={() => void ask("review")}
          >
            {copy.exercise.reviewCode}
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
              {copy.exercise.explain}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => void ask("hint")}
            >
              {copy.exercise.hint}
            </Button>
          </>
        )}
      </div>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {copy.exercise.reviewThinking}
        </p>
      ) : null}
      {error !== null ? (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {review !== null ? (
        <section
          className="grid min-w-0 gap-3 rounded-md bg-secondary/60 px-3 py-3"
          aria-label={copy.exercise.teacher}
        >
          <h3 className="text-sm font-medium">{copy.exercise.teacher}</h3>
          <ReviewBlock title={copy.exercise.reviewSummary} text={review.summary} />
          <ReviewBlock title={copy.exercise.reviewFeedback} text={review.feedback} />
          {review.strengths.length > 0 ? (
            <div className="grid gap-1">
              <p className="text-sm font-medium">{copy.exercise.strengths}</p>
              <ul className="grid gap-1">
                {review.strengths.map((item) => (
                  <li key={item} className="break-words text-sm leading-6">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.issues.length > 0 ? (
            <div className="grid gap-1">
              <p className="text-sm font-medium">{copy.exercise.issues}</p>
              <ul className="grid gap-1">
                {review.issues.map((issue) => (
                  <li
                    key={`${issue.type}-${issue.description}`}
                    className="break-words text-sm leading-6"
                  >
                    {issue.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.hint !== undefined ? (
            <ReviewBlock title={copy.exercise.hintLabel} text={review.hint} />
          ) : null}
          {review.nextQuestion !== undefined ? (
            <ReviewBlock title={copy.exercise.nextQuestion} text={review.nextQuestion} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ReviewBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="break-words text-sm leading-6">{text}</p>
    </div>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof NetworkError) {
    return copy.errors.network;
  }
  if (!isApiError(error)) {
    return copy.errors.generic;
  }
  return error.message;
}
