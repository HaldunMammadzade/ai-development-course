"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import type {
  HomeworkCompletionResponse,
  HomeworkListResponse,
  LearningCatalog,
  TeachingHomeworkView,
} from "@platform/types";
import { HomeworkActions } from "@/components/homework/homework-actions";
import { apiGet, apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { formatWhen } from "@/lib/format";
import { findCurrentLesson, lessonHref } from "@/lib/learning/catalog-view";
import { actionLabel } from "@/lib/teaching/presentation";

export function HomeworkBoard({
  initial,
  timeZone,
  nowIso,
}: {
  initial: HomeworkListResponse;
  timeZone: string;
  nowIso: string;
}) {
  const [items, setItems] = useState(initial.homework);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<HomeworkCompletionResponse | null>(null);
  const [catalog, setCatalog] = useState<LearningCatalog | null>(null);

  const active = items.filter((item) => item.status === "assigned");
  const done = items.filter((item) => item.status === "done");

  async function complete(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const result = await apiPost<HomeworkCompletionResponse>(
        `/api/v1/teaching/homework/${id}/complete`,
      );
      setItems((current) => current.map((item) => (item.id === id ? result.homework : item)));
      setSuccess(result);
      setConfirmId(null);
      const next = await apiGet<LearningCatalog>("/api/v1/learning/catalog");
      setCatalog(next);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.network);
    } finally {
      setPendingId(null);
    }
  }

  const current = catalog === null ? null : findCurrentLesson(catalog);

  return (
    <div className="grid max-w-3xl gap-8">
      <header>
        <h1 className="font-serif text-4xl tracking-tight">{copy.homework.title}</h1>
      </header>
      {success !== null ? (
        <section className="surface border-primary/20 bg-accent p-5" role="status">
          <h2 className="font-serif text-2xl">{copy.homework.success}</h2>
          <p className="mt-2 text-sm leading-6">{copy.homework.progress}</p>
          {current !== null && success.learning.nextAction.kind !== "do_homework" ? (
            <p className="mt-3 text-sm">
              {copy.homework.nextLesson}: {current.lesson.title}
            </p>
          ) : null}
          {success.learning.nextAction.kind === "path_complete" ? (
            <p className="mt-3 text-sm">{copy.teacher.pathDone}</p>
          ) : null}
          {current !== null && success.learning.nextAction.kind !== "do_homework" ? (
            <Link
              href={lessonHref(current.lesson.slug)}
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {actionLabel(success.learning.nextAction)}
            </Link>
          ) : null}
        </section>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <HomeworkSection
        title={copy.homework.active}
        empty={copy.homework.emptyActive}
        items={active}
      >
        {(item) => (
          <HomeworkActions
            item={item}
            timeZone={timeZone}
            nowIso={nowIso}
            confirming={confirmId === item.id}
            pending={pendingId === item.id}
            onAsk={() => setConfirmId(item.id)}
            onCancel={() => setConfirmId(null)}
            onConfirm={() => void complete(item.id)}
          />
        )}
      </HomeworkSection>
      <HomeworkSection title={copy.homework.done} empty={copy.homework.emptyDone} items={done}>
        {(item) => <CompletedMeta item={item} timeZone={timeZone} />}
      </HomeworkSection>
    </div>
  );
}

function HomeworkSection({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty: string;
  items: TeachingHomeworkView[];
  children: (item: TeachingHomeworkView) => ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="font-serif text-2xl">{title}</h2>
      {items.length === 0 ? (
        <div className="text-sm leading-6 text-muted-foreground">
          <p>{empty}</p>
          {title === copy.homework.active ? (
            <p className="mt-2">{copy.dashboard.noHomeworkNext}</p>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-[var(--color-border-subtle)] py-5">
              <p className="text-sm font-medium text-muted-foreground">
                {item.status === "done" ? copy.homework.statusDone : copy.homework.statusAssigned}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{item.lessonTitle}</h3>
              <p className="mt-3 whitespace-pre-wrap leading-7">{item.prompt}</p>
              {children(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompletedMeta({ item, timeZone }: { item: TeachingHomeworkView; timeZone: string }) {
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {copy.homework.completedAt}:{" "}
      {item.completedAt === null ? "—" : formatWhen(item.completedAt, timeZone)}
    </p>
  );
}
