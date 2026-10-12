"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentView } from "@platform/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/controls";
import { apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

function messageFor(error: unknown): string {
  if (error instanceof NetworkError) {
    return copy.errors.network;
  }
  return copy.errors.generic;
}

export function AssessmentForm({ view }: { view: AssessmentView }) {
  const router = useRouter();
  const item = view.item;
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (item === null) {
    return null;
  }
  const current = item;
  const answer = current.kind === "mcq" ? choice : text;

  async function submit(): Promise<void> {
    if (answer.trim().length === 0 || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/assessment/answers", {
        itemId: current.id,
        answer,
        clientAttemptId: createClientTurnId(),
      });
      setChoice("");
      setText("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof NetworkError || isApiError(caught) ? messageFor(caught) : copy.errors.generic,
      );
    } finally {
      setPending(false);
    }
  }

  async function skip(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/assessment/skip", {});
      router.push("/app/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof NetworkError ? copy.errors.network : copy.errors.generic);
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="grid gap-3" disabled={pending}>
        <legend className="text-base font-medium">{current.prompt}</legend>
        {current.kind === "mcq" ? (
          <div className="grid gap-2" role="radiogroup" aria-label={current.prompt}>
            {current.options.map((option) => (
              <label key={option.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="assessment-choice"
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => setChoice(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label={current.kind === "code" ? copy.assessment.code : copy.assessment.short}
            className={current.kind === "code" ? "min-h-40 font-mono" : undefined}
            spellCheck={current.kind === "short"}
          />
        )}
      </fieldset>
      {view.previous !== null ? (
        <div className="grid gap-2">
          <Button type="button" variant="secondary" className="w-fit" onClick={() => setShowPrevious((open) => !open)}>
            {showPrevious ? copy.assessment.hidePrevious : copy.assessment.previous}
          </Button>
          {showPrevious ? (
            <p className="text-sm" role="status">
              {view.previous.passed ? copy.assessment.accepted : copy.assessment.missed} {view.previous.submission}
            </p>
          ) : null}
        </div>
      ) : null}
      {error !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || answer.trim().length === 0}>
          {copy.assessment.submit}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void skip()}>
          {copy.assessment.skip}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{copy.assessment.skipNote}</p>
    </form>
  );
}
