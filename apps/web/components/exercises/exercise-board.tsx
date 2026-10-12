"use client";

import { useEffect, useRef, useState } from "react";
import type { Difficulty, ExerciseAttemptView, ExerciseView } from "@platform/types";
import { CodeReviewPanel } from "@/components/exercises/code-review-panel";
import { CodingEditor } from "@/components/exercises/coding-editor";
import { ExerciseResult } from "@/components/exercises/exercise-result";
import { ExerciseSubmission } from "@/components/exercises/exercise-submission";
import { languageLabel, answerSurface } from "@/components/exercises/editor-language";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/status";
import { apiGet, apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

export function ExerciseBoard({ exercises }: { exercises: ExerciseView[] }) {
  const [selectedId, setSelectedId] = useState(exercises[0]?.id ?? "");
  const selected = exercises.find((exercise) => exercise.id === selectedId) ?? exercises[0];
  if (selected === undefined) {
    return null;
  }

  return (
    <section
      className="surface mx-auto grid w-full min-w-0 max-w-6xl gap-0 overflow-x-hidden"
      aria-labelledby="exercise-heading"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <p id="exercise-heading" className="text-sm font-medium text-primary">
          {copy.exercise.title}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {exercises.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className={
                exercise.id === selected.id
                  ? "min-h-11 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  : "min-h-11 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              }
              aria-pressed={exercise.id === selected.id}
              onClick={() => setSelectedId(exercise.id)}
            >
              {exercise.title}
            </button>
          ))}
        </div>
      </div>
      <ExerciseAttempt key={selected.id} exercise={selected} />
    </section>
  );
}

function ExerciseAttempt({ exercise }: { exercise: ExerciseView }) {
  const starter = exercise.starterCode ?? "";
  const [submission, setSubmission] = useState(starter);
  const [attemptId, setAttemptId] = useState(createClientTurnId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExerciseAttemptView | null>(null);
  const [history, setHistory] = useState<ExerciseAttemptView[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const pendingRef = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmReset) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmReset(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReset]);

  useEffect(() => {
    let current = true;
    void apiGet<{ attempts: ExerciseAttemptView[] }>(`/api/v1/exercises/${exercise.id}/attempts`)
      .then((body) => {
        if (current) {
          setHistory(body.attempts);
        }
      })
      .catch(() => {
        if (current) {
          setHistory([]);
        }
      });
    return () => {
      current = false;
    };
  }, [exercise.id]);

  async function loadHistory(): Promise<void> {
    const body = await apiGet<{ attempts: ExerciseAttemptView[] }>(
      `/api/v1/exercises/${exercise.id}/attempts`,
    );
    if (active.current) {
      setHistory(body.attempts);
    }
  }

  async function submit(): Promise<void> {
    if (pendingRef.current || submission.trim().length === 0) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const saved = await apiPost<ExerciseAttemptView>(
        `/api/v1/exercises/${exercise.id}/attempts`,
        {
          clientAttemptId: attemptId,
          submission,
        },
      );
      if (!active.current) {
        return;
      }
      setResult(saved);
      setAttemptId(createClientTurnId());
      try {
        await loadHistory();
      } catch {
        if (active.current) {
          setHistory([]);
        }
      }
    } catch (caught) {
      if (active.current) {
        setError(messageFor(caught));
      }
    } finally {
      pendingRef.current = false;
      if (active.current) {
        setPending(false);
      }
    }
  }

  function askReset(): void {
    if (pending || submission === starter) {
      return;
    }
    setConfirmReset(true);
  }

  function applyReset(): void {
    setSubmission(starter);
    setConfirmReset(false);
    setResult(null);
    setError(null);
  }

  const lines = submission === "" ? 0 : submission.split("\n").length;

  return (
    <div className="grid min-w-0">
      <div className="order-1 min-w-0 border-b border-border px-4 py-5 sm:px-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          {exercise.type === "code_text" ? languageLabel(exercise.language) : copy.exercise.title}
          {" · "}
          {difficultyLabel(exercise.difficulty)}
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight">{exercise.title}</h2>
        <h3 className="mt-5 text-sm font-medium">{copy.exercise.task}</h3>
        <p className="mt-2 break-words text-base leading-7">{exercise.prompt}</p>
        <h3 className="mt-5 text-sm font-medium">{copy.exercise.goal}</h3>
        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
          {exercise.instructions}
        </p>
      </div>

      <div className="order-2 min-w-0">
        {answerSurface(exercise) === "choice" ? (
          <fieldset className="grid gap-2 px-4 py-5 sm:px-5">
            <legend className="sr-only">{exercise.title}</legend>
            {exercise.options.map((option) => (
              <label
                key={option.id}
                className={
                  submission === option.id
                    ? "flex min-h-11 items-start gap-3 border border-border border-l-2 border-l-[var(--color-accent-primary)] bg-secondary px-3 py-2"
                    : "flex min-h-11 items-start gap-3 border border-border px-3 py-2"
                }
              >
                <input
                  type="radio"
                  name={exercise.id}
                  value={option.id}
                  className="mt-1"
                  checked={submission === option.id}
                  onChange={() => setSubmission(option.id)}
                />
                <span className="break-words">{option.label}</span>
              </label>
            ))}
          </fieldset>
        ) : answerSurface(exercise) === "text" ? (
          <ShortAnswer
            id={exercise.id}
            value={submission}
            disabled={pending}
            confirm={confirmReset}
            onChange={setSubmission}
            onReset={askReset}
            onCancelReset={() => setConfirmReset(false)}
            onApplyReset={applyReset}
          />
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                {languageLabel(exercise.language)}
                <span className="px-2" aria-hidden="true">
                  ·
                </span>
                {lines} {copy.exercise.lines}
              </p>
              <Button
                variant="ghost"
                className="min-h-11 px-3"
                disabled={pending}
                onClick={askReset}
              >
                {copy.exercise.reset}
              </Button>
            </div>
            {confirmReset ? (
              <div
                role="dialog"
                aria-labelledby={`reset-${exercise.id}`}
                className="border-b border-border bg-secondary/70 px-3 py-3"
              >
                <p id={`reset-${exercise.id}`} className="text-sm leading-6">
                  {copy.exercise.resetConfirm}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => setConfirmReset(false)}
                  >
                    {copy.exercise.resetNo}
                  </Button>
                  <Button className="min-h-11" onClick={applyReset}>
                    {copy.exercise.resetYes}
                  </Button>
                </div>
              </div>
            ) : null}
            <CodingEditor
              language={exercise.language}
              value={submission}
              readOnly={pending}
              disabled={pending}
              onChange={setSubmission}
            />
          </div>
        )}
      </div>

      <div className="order-3 min-w-0 border-t border-border px-4 py-4 sm:px-5">
        <div className="grid gap-4">
          {pending ? (
            <div className="grid gap-2" aria-busy="true">
              <p role="status" className="text-sm text-muted-foreground">
                {copy.exercise.checking}
              </p>
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}
          {error !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!pending && result !== null ? (
            <ExerciseResult
              result={result}
              retry={
                exercise.type === "code_text" ? copy.exercise.retry : copy.exercise.retryChoice
              }
            />
          ) : null}
          {!pending && result !== null && exercise.executionAvailable ? (
            <CodeReviewPanel key={result.id} exerciseId={exercise.id} attempt={result} />
          ) : null}
          {!pending && result === null && error === null && exercise.type === "code_text" ? (
            <p className="text-sm text-muted-foreground">
              {exercise.executionAvailable
                ? copy.exercise.executionReady
                : copy.exercise.noExecution}
            </p>
          ) : null}
          <div className="flex sm:justify-end">
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={pending || submission.trim().length === 0}
              onClick={() => void submit()}
            >
              {pending ? copy.exercise.checking : copy.exercise.check}
            </Button>
          </div>
        </div>
        <History exerciseId={exercise.id} history={history} />
      </div>
    </div>
  );
}

function ShortAnswer({
  id,
  value,
  disabled,
  confirm,
  onChange,
  onReset,
  onCancelReset,
  onApplyReset,
}: {
  id: string;
  value: string;
  disabled: boolean;
  confirm: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onCancelReset: () => void;
  onApplyReset: () => void;
}) {
  const rows = Math.min(6, Math.max(2, value === "" ? 1 : value.split("\n").length));
  return (
    <div className="grid min-w-0 gap-2 px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={`answer-${id}`} className="text-sm font-medium">
          {copy.exercise.answerLabel}
        </label>
        <Button variant="ghost" className="min-h-11 px-3" disabled={disabled} onClick={onReset}>
          {copy.exercise.reset}
        </Button>
      </div>
      {confirm ? (
        <div role="dialog" aria-labelledby={`reset-${id}`} className="grid gap-3">
          <p id={`reset-${id}`} className="text-sm leading-6">
            {copy.exercise.resetConfirm}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={onCancelReset}>
              {copy.exercise.resetNo}
            </Button>
            <Button className="min-h-11" onClick={onApplyReset}>
              {copy.exercise.resetYes}
            </Button>
          </div>
        </div>
      ) : null}
      <textarea
        id={`answer-${id}`}
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full min-w-0 resize-y overflow-x-hidden rounded-md border border-input bg-background px-3 py-2 text-base leading-7 break-words whitespace-pre-wrap outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      />
    </div>
  );
}

function History({
  exerciseId,
  history,
}: {
  exerciseId: string;
  history: ExerciseAttemptView[] | null;
}) {
  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="text-sm font-medium">{copy.exercise.history}</p>
      {history === null ? null : history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{copy.exercise.emptyHistory}</p>
      ) : (
        <ol className="mt-3 grid gap-3">
          {history.map((attempt) => (
            <li
              key={`${exerciseId}-${attempt.id}`}
              className="rounded-md bg-secondary/60 px-3 py-2"
            >
              <p className="text-sm">
                {attempt.attemptNumber}.{" "}
                {attempt.passed ? copy.exercise.passed : copy.exercise.failed} · {attempt.score}
              </p>
              <ExerciseSubmission submission={attempt.submission} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function difficultyLabel(difficulty: Difficulty): string {
  return copy.exercise.difficulty[difficulty];
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
