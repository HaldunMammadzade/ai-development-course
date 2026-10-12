"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_FILE_NAMES,
  type ProjectAttemptListResponse,
  type ProjectAttemptView,
  type ProjectDetail,
  type ProjectDetailResponse,
  type ProjectFiles,
  type ProjectMilestoneView,
  type ProjectPlanResponse,
} from "@platform/types";
import Link from "next/link";
import { CodingEditor } from "@/components/exercises/coding-editor";
import { ProjectReviewPanel } from "@/components/projects/project-review-panel";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/client";
import { isApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import { formatWhen } from "@/lib/format";
import { createClientTurnId } from "@/lib/teaching/turn-id";
import { cn } from "@/lib/utils";

const languages = {
  "index.html": "html",
  "style.css": "css",
  "script.js": "javascript",
} as const;

export function ProjectBoard({ initial, timeZone }: { initial: ProjectDetail; timeZone: string }) {
  const [project, setProject] = useState(initial);
  const [selected, setSelected] = useState(initial.currentMilestone);
  const [fileName, setFileName] = useState<(typeof PROJECT_FILE_NAMES)[number]>("index.html");
  const [drafts, setDrafts] = useState<Record<string, ProjectFiles>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProjectAttemptView>>({});
  const [history, setHistory] = useState<ProjectAttemptView[]>([]);
  const [plan, setPlan] = useState(initial.plan?.body ?? "");
  const [planPending, setPlanPending] = useState(false);
  const milestone =
    project.milestones.find((item) => item.slug === selected) ?? project.milestones[0];
  const files =
    milestone === undefined ? null : (drafts[milestone.slug] ?? milestone.files ?? null);
  const result = milestone === undefined ? undefined : results[milestone.slug];

  const historySlug = milestone?.slug;
  const historyStatus = milestone?.status;
  useEffect(() => {
    if (historySlug === undefined || historyStatus === "locked") {
      return;
    }
    let active = true;
    void apiGet<ProjectAttemptListResponse>(
      `/api/v1/projects/${project.slug}/milestones/${historySlug}/attempts`,
    )
      .then((body) => {
        if (active) {
          setHistory(body.attempts);
        }
      })
      .catch(() => {
        if (active) {
          setHistory([]);
        }
      });
    return () => {
      active = false;
    };
  }, [historySlug, historyStatus, project.slug, result?.id]);

  if (milestone === undefined) {
    return null;
  }

  function updateFile(next: string): void {
    if (files === null || milestone === undefined || milestone.status === "locked") {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [milestone.slug]: { ...files, [fileName]: next },
    }));
  }

  async function savePlan(): Promise<void> {
    if (planPending || plan.trim().length < 20) {
      return;
    }
    setPlanPending(true);
    setError(null);
    try {
      const saved = await apiPost<ProjectPlanResponse>(`/api/v1/projects/${project.slug}/plan`, {
        body: plan,
      });
      setProject((current) => ({ ...current, plan: saved.plan }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPlanPending(false);
    }
  }

  async function reviewPlan(): Promise<void> {
    if (planPending || project.plan === null) {
      return;
    }
    setPlanPending(true);
    setError(null);
    try {
      const saved = await apiPost<ProjectPlanResponse>(
        `/api/v1/projects/${project.slug}/plan/review`,
      );
      setProject((current) => ({ ...current, plan: saved.plan }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPlanPending(false);
    }
  }

  async function check(): Promise<void> {
    if (files === null || milestone === undefined || milestone.status === "locked" || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const saved = await apiPost<ProjectAttemptView>(
        `/api/v1/projects/${project.slug}/milestones/${milestone.slug}/attempts`,
        { clientAttemptId: createClientTurnId(), files },
      );
      setResults((current) => ({ ...current, [milestone.slug]: saved }));
      if (saved.passed) {
        const fresh = await apiGet<ProjectDetailResponse>(`/api/v1/projects/${project.slug}`);
        setProject(fresh.project);
        if (fresh.project.currentMilestone !== milestone.slug) {
          setSelected(fresh.project.currentMilestone);
          setFileName("index.html");
        }
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const nextMilestone = project.milestones.find((item) => item.status === "locked") ?? null;
  const passedCount = project.milestones.filter((item) => item.status === "passed").length;

  return (
    <div className="grid w-full min-w-0 gap-10">
      <header className="grid max-w-3xl min-w-0 gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {project.slug === "taskflow" ? copy.projects.kind : copy.projects.bands[project.band]}
        </p>
        <h1 className="break-words font-serif text-4xl tracking-tight">{project.title}</h1>
        <p className="max-w-[65ch] text-base leading-7 text-muted-foreground">
          {project.description}
        </p>
        <p className="text-sm leading-6">
          {project.completed
            ? copy.projects.done
            : `${copy.projects.current}: ${
                project.milestones.find((item) => item.slug === project.currentMilestone)?.title ??
                milestone.title
              }`}
        </p>
        {project.concepts.length > 0 ? (
          <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
            {project.concepts.map((item) => item.name).join(" · ")}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {project.estimatedMinutes} {copy.projects.minutes}
        </p>
        {project.completed ? null : (
          <a
            href="#current-milestone"
            className="inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {copy.projects.continueWork}
          </a>
        )}
      </header>

      {project.completed ? (
        <section className="grid max-w-3xl gap-3" aria-labelledby="project-complete">
          <h2 id="project-complete" className="font-serif text-3xl tracking-tight">
            {project.title} {copy.projects.statePassed.toLocaleLowerCase()}
          </h2>
          <p className="max-w-[65ch] leading-7">{copy.projects.completedLead}</p>
          <p className="text-sm font-medium">{copy.projects.portfolioMark}</p>
          <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
            {project.objective}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/app/achievements"
              className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
            >
              {copy.projects.seeMilestones} →
            </Link>
            <Link
              href="/app/dashboard"
              className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
            >
              {copy.projects.backToLearning} →
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 items-start gap-10 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="grid content-start gap-1" aria-label={copy.projects.milestones}>
          <h2 className="text-sm font-medium text-muted-foreground">{copy.projects.milestones}</h2>
          <ol className="grid">
            {project.milestones.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  disabled={item.status === "locked"}
                  aria-current={item.slug === milestone.slug ? "step" : undefined}
                  onClick={() => {
                    setSelected(item.slug);
                    setFileName("index.html");
                  }}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start justify-center py-2 text-left",
                    item.slug === milestone.slug ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  <span className="break-words">
                    {item.position}. {item.title}
                  </span>
                  <span className="text-sm">{workflowLabel(item)}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            {passedCount} {copy.projects.statePassed.toLocaleLowerCase()}
          </p>
        </nav>

        <div className="grid min-w-0 gap-10">
          <section id="current-milestone" className="grid max-w-3xl gap-3" aria-labelledby="phase">
            <h2 id="phase" className="text-sm font-medium text-muted-foreground">
              {copy.projects.phase}
            </h2>
            <p className="font-serif text-3xl tracking-tight">{milestone.title}</p>
            {milestone.objective !== undefined ? (
              <p className="max-w-[65ch] leading-7">{milestone.objective}</p>
            ) : null}
            {milestone.instructions !== undefined ? (
              <div className="grid gap-1">
                <h3 className="text-sm font-medium">{copy.projects.requirements}</h3>
                <p className="max-w-[65ch] text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                  {milestone.instructions}
                </p>
              </div>
            ) : null}
            {milestone.concepts !== undefined && milestone.concepts.length > 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {copy.projects.concepts}: {milestone.concepts.map((item) => item.name).join(", ")}
              </p>
            ) : null}
          </section>

          {files !== null ? (
            <section className="grid min-w-0 gap-3" aria-labelledby="workspace">
              <h2 id="workspace" className="text-sm font-medium text-muted-foreground">
                {copy.projects.workspace}
              </h2>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={copy.projects.files}>
                {PROJECT_FILE_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={fileName === name}
                    onClick={() => setFileName(name)}
                    className={cn(
                      "min-h-11 px-3 text-sm",
                      fileName === name ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <CodingEditor
                language={languages[fileName]}
                value={files[fileName]}
                onChange={updateFile}
                disabled={pending || milestone.status === "locked"}
              />
              <Button
                type="button"
                className="min-h-11 w-fit"
                disabled={pending}
                onClick={() => void check()}
              >
                {pending ? copy.projects.checking : copy.projects.check}
              </Button>
            </section>
          ) : (
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {copy.projects.nextLocked}
            </p>
          )}

          {error !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {result !== undefined ? (
            <section className="grid max-w-3xl gap-2" aria-labelledby="verification">
              <h2 id="verification" className="text-sm font-medium text-muted-foreground">
                {copy.projects.verify}
              </h2>
              <p className="text-sm font-medium">{copy.projects.result}</p>
              <p className="text-sm leading-6">
                {result.passed ? copy.projects.passed : copy.projects.retry}
              </p>
              {result.passed ? null : (
                <p className="text-sm leading-6 text-muted-foreground">{copy.projects.debug}</p>
              )}
              <p className="text-sm leading-6 whitespace-pre-wrap">{result.feedback}</p>
              {result.passedChecks.length > 0 ? (
                <ReviewList title={copy.projects.works} items={result.passedChecks} />
              ) : null}
              {result.failedChecks.length > 0 ? (
                <ReviewList title={copy.projects.attention} items={result.failedChecks} />
              ) : null}
            </section>
          ) : null}

          {result !== undefined ? (
            <ProjectReviewPanel key={result.id} projectSlug={project.slug} attempt={result} />
          ) : milestone.status !== "locked" ? (
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {copy.projects.mentorWait}
            </p>
          ) : null}

          {nextMilestone !== null && milestone.status !== "locked" ? (
            <section className="grid max-w-3xl gap-1" aria-labelledby="next-phase">
              <h2 id="next-phase" className="text-sm font-medium text-muted-foreground">
                {copy.projects.nextPhase}
              </h2>
              <p className="text-base font-medium">
                {nextMilestone.position}. {nextMilestone.title}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">{copy.projects.nextLocked}</p>
            </section>
          ) : null}

          {milestone.status !== "locked" ? (
            <section className="grid max-w-3xl gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{copy.projects.history}</h2>
              {history.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.projects.emptyHistory}
                </p>
              ) : (
                <ol className="grid gap-2">
                  {history.map((item) => (
                    <li key={item.id} className="text-sm leading-6 break-words">
                      {copy.exercise.attempt} {item.attemptNumber}:{" "}
                      {item.passed ? copy.projects.passed : copy.projects.failed} · {item.feedback}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}
        </div>
      </div>

      <section className="grid max-w-3xl gap-3" aria-labelledby="building">
        <h2 id="building" className="text-sm font-medium text-muted-foreground">
          {copy.projects.building}
        </h2>
        <p className="max-w-[65ch] leading-7">{project.brief.goal}</p>
        <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">{project.objective}</p>
        <RequirementList title={copy.projects.required} items={project.brief.required} />
        <RequirementList title={copy.projects.recommended} items={project.brief.recommended} />
        <RequirementList title={copy.projects.optional} items={project.brief.optional} />
      </section>

      {project.concepts.length > 0 ? (
        <section className="grid max-w-3xl gap-2" aria-labelledby="skills">
          <h2 id="skills" className="text-sm font-medium text-muted-foreground">
            {copy.projects.practice}
          </h2>
          <ul className="grid gap-1">
            {project.concepts.map((item) => (
              <li key={item.slug} className="text-sm leading-6">
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid max-w-3xl gap-3" aria-labelledby="plan">
        <h2 id="plan" className="text-sm font-medium text-muted-foreground">
          {copy.projects.plan}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{copy.projects.planNote}</p>
        <textarea
          className="min-h-32 w-full min-w-0 rounded-md border border-border bg-background p-3 text-sm"
          maxLength={2000}
          value={plan}
          placeholder={copy.projects.planPlaceholder}
          onChange={(event) => setPlan(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={planPending}
            onClick={() => void savePlan()}
          >
            {planPending ? copy.projects.savingPlan : copy.projects.savePlan}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={planPending || project.plan === null}
            onClick={() => void reviewPlan()}
          >
            {planPending ? copy.projects.reviewingPlan : copy.projects.reviewPlan}
          </Button>
        </div>
        {project.plan?.review !== null && project.plan?.review !== undefined ? (
          <div className="grid min-w-0 gap-2 text-sm">
            <p className="leading-6 break-words">{project.plan.review.summary}</p>
            <ReviewList title={copy.projects.strengths} items={project.plan.review.strengths} />
            <ReviewList title={copy.projects.risks} items={project.plan.review.risks} />
            <ReviewList title={copy.projects.suggestions} items={project.plan.review.suggestions} />
            <ReviewList title={copy.projects.questions} items={project.plan.review.questions} />
          </div>
        ) : null}
      </section>

      {project.portfolio !== null ? (
        <section className="grid max-w-3xl gap-2" aria-labelledby="portfolio">
          <h2 id="portfolio" className="text-sm font-medium text-muted-foreground">
            {copy.projects.portfolio}
          </h2>
          <p className="text-sm font-medium">{copy.projects.portfolioMark}</p>
          <p className="text-sm leading-6">
            {copy.projects.problem}: {project.portfolio.problem}
          </p>
          <p className="text-sm leading-6">
            {copy.projects.technologies}: {project.portfolio.technologies.join(", ")}
          </p>
          <p className="text-sm leading-6">
            {copy.projects.features}: {project.portfolio.features.join(", ")}
          </p>
          <p className="text-sm leading-6">
            {copy.projects.skills}: {project.portfolio.skills.join(", ")}
          </p>
          <p className="text-sm leading-6">
            {copy.projects.completedOn}: {formatWhen(project.portfolio.completedAt, timeZone)}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function workflowLabel(item: ProjectMilestoneView): string {
  if (item.workflow === "PASSED") {
    return copy.projects.statePassed;
  }
  if (item.workflow === "FAILED") {
    return copy.projects.stateFailed;
  }
  if (item.workflow === "SUBMITTED") {
    return copy.projects.submitted;
  }
  if (item.workflow === "TODO") {
    return copy.projects.stateLocked;
  }
  return copy.projects.stateCurrent;
}

function RequirementList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="grid min-w-0 gap-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item} className="break-words text-sm text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="grid min-w-0 gap-1">
      <h3 className="font-medium">{title}</h3>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item} className="break-words text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function errorMessage(caught: unknown): string {
  return caught instanceof NetworkError
    ? copy.errors.network
    : isApiError(caught)
      ? caught.message
      : copy.errors.generic;
}
