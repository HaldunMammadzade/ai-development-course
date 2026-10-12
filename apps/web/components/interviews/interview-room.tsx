"use client";

import { useRef, useState } from "react";
import type { InterviewSessionView } from "@platform/types";
import { CodingEditor } from "@/components/exercises/coding-editor";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

export function InterviewRoom({ initial }: { initial: InterviewSessionView }) {
  const [session, setSession] = useState(initial);
  const [text, setText] = useState("");
  const [code, setCode] = useState(initial.question?.starterCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const answerId = useRef<string | null>(null);

  async function submit(): Promise<void> {
    if (session.question === null || session.status !== "active") {
      return;
    }
    setPending(true);
    setError(null);
    answerId.current ??= createClientTurnId();
    try {
      const body: unknown = await apiPost(`/api/v1/interview-sessions/${session.id}/answers`, {
        clientAnswerId: answerId.current,
        text,
        ...(session.question.type === "code" ? { code } : {}),
      });
      const next = readSession(body);
      if (next === null) {
        setError(copy.errors.generic);
        return;
      }
      answerId.current = null;
      setText("");
      setCode(next.question?.starterCode ?? "");
      setSession(next);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function abandon(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const body: unknown = await apiPost(`/api/v1/interview-sessions/${session.id}/abandon`, {});
      const next = readSession(body);
      if (next !== null) {
        setSession(next);
      }
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  const question = session.question;
  return (
    <div className="grid min-w-0 max-w-full gap-5 overflow-x-hidden">
      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">{session.interviewTitle}</p>
        <h1 className="break-words font-serif text-3xl">{copy.interviews.title}</h1>
      </header>
      {question === null ? null : (
        <section className="grid min-w-0 gap-2 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {question.followUp
              ? copy.interviews.followUp
              : `${copy.interviews.progress}: ${question.position} / ${question.total}`}
          </p>
          <h2 className="break-words text-xl">{question.title}</h2>
          <p className="break-words">{question.prompt}</p>
        </section>
      )}
      {session.speech === null ? null : (
        <section className="grid min-w-0 gap-1 rounded-md border border-border bg-secondary p-4">
          <h2 className="text-sm font-medium">{copy.interviews.interviewer}</h2>
          <p className="break-words">{session.speech}</p>
          <p className="text-sm text-muted-foreground">{copy.interviews.interviewerNote}</p>
        </section>
      )}
      {session.report === null ? null : <Report report={session.report} />}
      {session.status === "abandoned" ? (
        <p className="break-words">{copy.interviews.abandoned}</p>
      ) : null}
      {session.status !== "active" || question === null ? null : (
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="grid min-w-0 gap-1">
            <span className="text-sm font-medium">{copy.interviews.answer}</span>
            <textarea
              className="min-h-28 w-full min-w-0 rounded-md border border-input bg-card p-3"
              value={text}
              maxLength={6000}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {question.type === "code" ? (
            <div className="grid min-w-0 gap-1">
              <span className="text-sm font-medium">{copy.interviews.code}</span>
              <CodingEditor language="javascript" value={code} onChange={setCode} />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button type="submit" disabled={pending || text.trim().length === 0}>
              {pending ? copy.interviews.submitting : copy.interviews.submit}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void abandon()}
            >
              {pending ? copy.interviews.abandoning : copy.interviews.abandon}
            </Button>
          </div>
        </form>
      )}
      {error === null ? null : (
        <p className="break-words text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Report({ report }: { report: NonNullable<InterviewSessionView["report"]> }) {
  return (
    <section className="grid min-w-0 gap-3 rounded-md border border-border bg-card p-4">
      <h2 className="font-medium">{copy.interviews.completed}</h2>
      <p className="text-sm text-muted-foreground">{copy.interviews.scoreNote}</p>
      <p>
        {copy.interviews.score}: {report.finalScore}
      </p>
      <p>
        {copy.interviews.band}: {copy.interviews.bands[report.band]}
      </p>
      <p className="break-words">{report.summary}</p>
      <List title={copy.interviews.strengths} items={report.strengths} />
      <List title={copy.interviews.weaknesses} items={report.weaknesses} />
      <List title={copy.interviews.review} items={report.conceptsToReview} />
      <p className="break-words">
        {copy.interviews.next}: {report.nextAction}
      </p>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="grid min-w-0 gap-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function readSession(value: unknown): InterviewSessionView | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const session = (value as { session?: InterviewSessionView }).session;
  if (
    session === undefined ||
    typeof session.id !== "string" ||
    typeof session.status !== "string"
  ) {
    return null;
  }
  return session;
}
