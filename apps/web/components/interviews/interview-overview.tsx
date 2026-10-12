"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InterviewDetail } from "@platform/types";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";

export function InterviewOverview({ interview }: { interview: InterviewDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = interview.activeSessionId;

  async function start(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const body: unknown = await apiPost(`/api/v1/interviews/${interview.slug}/sessions`, {});
      const sessionId = readSessionId(body);
      if (sessionId === null) {
        setError(copy.errors.generic);
        return;
      }
      router.push(`/app/interviews/session/${sessionId}`);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 max-w-full gap-5 overflow-x-hidden">
      <header className="grid gap-2">
        <h1 className="break-words font-serif text-3xl">{interview.title}</h1>
        <p className="break-words text-muted-foreground">{interview.description}</p>
      </header>
      <section className="grid min-w-0 gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="font-medium">{copy.interviews.objective}</h2>
        <p className="break-words">{interview.objective}</p>
        <p className="text-sm text-muted-foreground">
          {copy.interviews.questions}: {interview.questionCount}
        </p>
      </section>
      {active === null ? (
        <Button type="button" onClick={() => void start()} disabled={pending}>
          {pending ? copy.interviews.starting : copy.interviews.start}
        </Button>
      ) : (
        <Button type="button" onClick={() => router.push(`/app/interviews/session/${active}`)}>
          {copy.interviews.resume}
        </Button>
      )}
      {error === null ? null : <p className="break-words text-destructive">{error}</p>}
      <section className="grid min-w-0 gap-2">
        <h2 className="font-medium">{copy.interviews.history}</h2>
        {interview.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.interviews.emptyHistory}</p>
        ) : (
          <ul className="grid min-w-0 gap-2">
            {interview.history.map((item) => (
              <li key={item.id} className="min-w-0 break-words text-sm">
                <a className="underline" href={`/app/interviews/session/${item.id}`}>
                  {item.status}
                  {item.finalScore === null ? "" : ` · ${item.finalScore}`}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function readSessionId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const session = (value as { session?: { id?: unknown } }).session;
  return typeof session?.id === "string" ? session.id : null;
}
