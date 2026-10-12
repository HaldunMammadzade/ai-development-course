"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AdaptiveDecision } from "@platform/curriculum";
import type {
  LearningCatalog,
  TeachingMessageView,
  TeachingOpenResponse,
  TeachingSessionView,
  TeachingTurnResponse,
  Understanding,
} from "@platform/types";
import { LessonWorkspace } from "@/components/teaching/lesson-workspace";
import { TeacherComposer } from "@/components/teaching/teacher-composer";
import { apiGet, apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { conceptName, lessonHref } from "@/lib/learning/catalog-view";
import { composerMode } from "@/lib/teaching/presentation";
import { createClientTurnId } from "@/lib/teaching/turn-id";
import { buildLessonWorkspace, type LessonPhase } from "@/lib/teaching/workspace";

export function LessonExperience({
  slug,
  catalog,
  children,
}: {
  slug: string;
  catalog: LearningCatalog;
  children?: ReactNode;
}) {
  const [session, setSession] = useState<TeachingSessionView | null>(null);
  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Array<{ name: string; understanding: Understanding }>>([]);
  const [adaptive, setAdaptive] = useState<AdaptiveDecision | null>(null);
  const [outline, setOutline] = useState(catalog);
  const turnId = useRef<string | null>(null);
  const sending = useRef(false);
  const router = useRouter();

  const applyOpen = useCallback(
    (opened: TeachingOpenResponse) => {
      if (opened.kind === "path_complete") {
        setPhase("path_complete");
        return;
      }
      if (opened.kind === "homework") {
        router.push("/app/homework");
        router.refresh();
        return;
      }
      if (opened.session.lessonSlug !== slug) {
        router.replace(lessonHref(opened.session.lessonSlug));
        return;
      }
      setSession(opened.session);
      setPhase(opened.session.state === "abandoned" ? "closed" : "ready");
    },
    [router, slug],
  );

  useEffect(() => {
    let ignore = false;
    void openSession().then(
      (opened) => {
        if (!ignore) {
          applyOpen(opened);
        }
      },
      (caught: unknown) => {
        if (ignore) {
          return;
        }
        setPhase("error");
        setError(caught instanceof Error ? caught.message : copy.errors.generic);
      },
    );
    return () => {
      ignore = true;
    };
  }, [applyOpen]);

  async function refreshOutline() {
    try {
      setOutline(await apiGet<LearningCatalog>("/api/v1/learning/catalog"));
    } catch {
      // The session response still has nextAction. The outline can stay.
    }
  }

  async function send(input: { message?: string; advance?: true }): Promise<boolean> {
    if (session === null || pending || sending.current) {
      return false;
    }
    const clientTurnId = turnId.current ?? createClientTurnId();
    turnId.current = clientTurnId;
    sending.current = true;
    setPending(true);
    setError(null);
    try {
      const turn = await apiPost<TeachingTurnResponse>(
        `/api/v1/teaching/sessions/${session.id}/turns`,
        {
          clientTurnId,
          ...(input.message === undefined ? { advance: true } : { message: input.message }),
        },
      );
      turnId.current = null;
      setSession((current) => applyTurn(current, turn, input.message));
      setAdaptive(turn.learning.adaptive?.decision ?? null);
      setNotice(
        turn.learning.updatedConcepts.map((concept) => ({
          name: conceptName(outline, concept.conceptSlug),
          understanding: concept.understanding,
        })),
      );
      if (turn.session.completed || turn.session.state === "completed") {
        await refreshOutline();
      }
      return true;
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setError(caught.message);
      } else if (isApiError(caught)) {
        turnId.current = null;
        if (caught.code === "SESSION_CLOSED") {
          setPhase("closed");
        }
        setError(
          caught.code === "AI_UNAVAILABLE" || caught.status === 503
            ? copy.errors.ai
            : caught.message,
        );
      } else {
        turnId.current = null;
        setError(copy.errors.generic);
      }
      return false;
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  async function restart() {
    setPhase("loading");
    setError(null);
    setSession(null);
    setAdaptive(null);
    try {
      applyOpen(await apiPost<TeachingOpenResponse>("/api/v1/teaching/sessions", {}));
    } catch (caught) {
      setPhase("error");
      setError(caught instanceof Error ? caught.message : copy.errors.generic);
    }
  }

  const mode = session === null ? null : composerMode(session.state);
  const model = buildLessonWorkspace({
    slug,
    catalog: outline,
    session,
    phase,
    pending,
    hasError: error !== null,
    adaptive,
    notice,
  });

  return (
    <LessonWorkspace
      model={model}
      phase={phase}
      pending={pending}
      error={error}
      onAdvance={() => void send({ advance: true })}
      onRestart={() => void restart()}
      composer={
        session !== null && mode === "answer" ? (
          <TeacherComposer
            disabled={phase !== "ready"}
            pending={pending}
            onSubmit={(message) => send({ message })}
          />
        ) : null
      }
    >
      {children}
    </LessonWorkspace>
  );
}

function applyTurn(
  current: TeachingSessionView | null,
  turn: TeachingTurnResponse,
  message: string | undefined,
): TeachingSessionView | null {
  if (current === null) {
    return current;
  }
  const student: TeachingMessageView[] =
    message === undefined
      ? []
      : [
          {
            id: `student-${turn.session.turnNumber}`,
            role: "student",
            speech: message,
            createdAt: new Date().toISOString(),
          },
        ];
  return {
    ...current,
    lessonSlug: turn.session.lessonSlug,
    lessonTitle: turn.session.lessonTitle,
    mode: turn.session.mode,
    state: turn.session.state,
    turnNumber: turn.session.turnNumber,
    completed: turn.session.completed,
    block: turn.block,
    homework: turn.homework,
    progress: turn.learning.mastery,
    nextAction: turn.learning.nextAction,
    messages: [
      ...current.messages,
      ...student,
      {
        id: `teacher-${turn.session.turnNumber}`,
        role: "teacher",
        speech: turn.teacher.message,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

let opening: Promise<TeachingOpenResponse> | null = null;

function openSession(): Promise<TeachingOpenResponse> {
  opening ??= apiPost<TeachingOpenResponse>("/api/v1/teaching/sessions", {}).finally(() => {
    opening = null;
  });
  return opening;
}
