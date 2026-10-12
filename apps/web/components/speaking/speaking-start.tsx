"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpeakingPractice } from "@platform/types";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";

export function SpeakingStart({ practice }: { practice: SpeakingPractice }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"lesson" | "interview" | null>(null);

  async function start(mode: "lesson" | "interview"): Promise<void> {
    setPending(mode);
    setError(null);
    try {
      const body: unknown = await apiPost("/api/v1/speaking/sessions", { mode });
      const sessionId = readSessionId(body);
      if (sessionId === null) {
        setError(copy.errors.generic);
        return;
      }
      router.push(`/app/speaking/session/${sessionId}`);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <header className="grid gap-2">
        <h1 className="font-serif text-3xl">{practice.title}</h1>
        <p className="break-words text-muted-foreground">{practice.description}</p>
        <p className="text-sm text-muted-foreground">
          {copy.speaking.progress}: {practice.questionCount}
        </p>
      </header>
      <div className="flex min-w-0 flex-wrap gap-2">
        <Button type="button" disabled={pending !== null} onClick={() => void start("lesson")}>
          {pending === "lesson" ? copy.speaking.starting : copy.speaking.lesson}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => void start("interview")}
        >
          {pending === "interview" ? copy.speaking.starting : copy.speaking.interview}
        </Button>
      </div>
      {practice.activeSessionId === null ? null : (
        <a
          className="text-sm font-semibold text-primary"
          href={`/app/speaking/session/${practice.activeSessionId}`}
        >
          {copy.interviews.resume}
        </a>
      )}
      {error === null ? null : <p className="break-words text-destructive">{error}</p>}
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
