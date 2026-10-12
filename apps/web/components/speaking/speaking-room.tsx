"use client";

import { useEffect, useRef, useState } from "react";
import type { SpeakingSessionView } from "@platform/types";
import { Button } from "@/components/ui/button";
import { apiForm, apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { createClientTurnId } from "@/lib/teaching/turn-id";

const MAX_MS = 60_000;

export function SpeakingRoom({ initial }: { initial: SpeakingSessionView }) {
  const [session, setSession] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const attemptId = useRef<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsed(next);
      if (next >= MAX_MS) {
        stopRecordingRef.current();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    return () => {
      releaseStream();
    };
  }, []);

  function releaseStream(): void {
    for (const track of stream.current?.getTracks() ?? []) {
      track.stop();
    }
    stream.current = null;
    recorder.current = null;
  }

  async function startRecording(): Promise<void> {
    setError(null);
    if (
      typeof MediaRecorder === "undefined" ||
      navigator.mediaDevices?.getUserMedia === undefined
    ) {
      setError(copy.speaking.unsupported);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(media);
      recorder.current = mediaRecorder;
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        releaseStream();
        setRecording(false);
        void submitAudio(blob);
      });
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      mediaRecorder.start();
    } catch {
      releaseStream();
      setRecording(false);
      setError(copy.speaking.denied);
    }
  }

  function stopRecording(): void {
    const mediaRecorder = recorder.current;
    if (mediaRecorder !== null && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      releaseStream();
      setRecording(false);
    }
  }
  stopRecordingRef.current = stopRecording;

  async function submitAudio(blob: Blob): Promise<void> {
    if (session.status !== "active") {
      return;
    }
    setPending(true);
    setError(null);
    attemptId.current ??= createClientTurnId();
    const body = new FormData();
    body.set("clientAttemptId", attemptId.current);
    body.set("durationMs", String(Math.min(MAX_MS, Date.now() - startedAt.current)));
    const type = blob.type.split(";")[0] || "audio/webm";
    body.set("audio", new File([blob], `answer.${extensionFor(type)}`, { type }));
    try {
      const response: unknown = await apiForm(
        `/api/v1/speaking/sessions/${session.id}/attempts`,
        body,
      );
      apply(response);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function submitText(): Promise<void> {
    if (session.status !== "active" || text.trim().length === 0) {
      return;
    }
    setPending(true);
    setError(null);
    attemptId.current ??= createClientTurnId();
    try {
      const response: unknown = await apiPost(`/api/v1/speaking/sessions/${session.id}/attempts`, {
        clientAttemptId: attemptId.current,
        text,
      });
      apply(response);
      setText("");
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  function apply(response: unknown): void {
    const next = readSession(response);
    if (next === null) {
      setError(copy.errors.generic);
      return;
    }
    attemptId.current = null;
    setSession(next);
  }

  async function abandon(): Promise<void> {
    setPending(true);
    try {
      const response: unknown = await apiPost(
        `/api/v1/speaking/sessions/${session.id}/abandon`,
        {},
      );
      const next = readSession(response);
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
  const seconds = Math.min(60, Math.floor(elapsed / 1000));
  return (
    <div className="grid min-w-0 max-w-full gap-5 overflow-x-hidden">
      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">
          {session.mode === "interview" ? copy.speaking.interview : copy.speaking.lesson}
        </p>
        <h1 className="break-words font-serif text-3xl">{copy.speaking.title}</h1>
      </header>
      {question === null ? null : (
        <section className="grid min-w-0 gap-2 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {copy.speaking.progress}: {question.position} / {question.total}
          </p>
          <h2 className="break-words text-xl">{question.title}</h2>
          <p className="break-words">{question.prompt}</p>
        </section>
      )}
      {session.feedback === null ? null : (
        <section className="grid min-w-0 gap-2 rounded-md border border-border bg-secondary p-4">
          <h2 className="text-sm font-medium">{copy.speaking.transcript}</h2>
          <p className="break-words">{session.feedback.transcript}</p>
          <h2 className="text-sm font-medium">{copy.speaking.feedback}</h2>
          <p className="break-words">{session.feedback.speech}</p>
          <p className="text-sm text-muted-foreground">
            {copy.speaking.understanding[session.feedback.understanding]}
          </p>
          <p className="break-words">{session.feedback.feedback}</p>
          <p className="text-sm text-muted-foreground">{copy.speaking.feedbackNote}</p>
        </section>
      )}
      {session.nextAction === null ? null : <p className="break-words">{session.nextAction}</p>}
      {session.status === "abandoned" ? <p>{copy.speaking.abandoned}</p> : null}
      {session.status === "completed" ? <p>{copy.speaking.completed}</p> : null}
      {session.status !== "active" || question === null ? null : (
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitText();
          }}
        >
          <p aria-live="polite" className="text-sm">
            {recording
              ? `${copy.speaking.recording}: ${seconds} saniyə`
              : pending
                ? copy.speaking.processing
                : ""}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {recording ? (
              <Button type="button" onClick={stopRecording}>
                {copy.speaking.stop}
              </Button>
            ) : (
              <Button type="button" disabled={pending} onClick={() => void startRecording()}>
                {copy.speaking.start}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void abandon()}
            >
              {copy.speaking.abandon}
            </Button>
          </div>
          <label className="grid min-w-0 gap-1">
            <span className="text-sm font-medium">{copy.speaking.text}</span>
            <textarea
              className="min-h-28 w-full min-w-0 rounded-md border border-input bg-card p-3"
              value={text}
              maxLength={6000}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={pending || recording || text.trim().length === 0}>
            {pending ? copy.speaking.submitting : copy.speaking.submit}
          </Button>
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

function extensionFor(type: string): string {
  if (type.includes("ogg")) {
    return "ogg";
  }
  if (type.includes("mp4")) {
    return "m4a";
  }
  if (type.includes("mpeg")) {
    return "mp3";
  }
  if (type.includes("wav")) {
    return "wav";
  }
  return "webm";
}

function readSession(value: unknown): SpeakingSessionView | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const session = (value as { session?: SpeakingSessionView }).session;
  if (
    session === undefined ||
    typeof session.id !== "string" ||
    typeof session.status !== "string"
  ) {
    return null;
  }
  return session;
}
