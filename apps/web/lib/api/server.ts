import { cookies } from "next/headers";
import { cache } from "react";
import type {
  AssessmentView,
  CurrentUser,
  ExerciseListResponse,
  HomeworkListResponse,
  InterviewDetail,
  InterviewListResponse,
  InterviewSessionView,
  SpeakingPractice,
  SpeakingSessionView,
  InterviewSummary,
  LearningCatalog,
  NextAction,
  ProjectDetail,
  ProjectListResponse,
  ProjectSummary,
  AchievementList,
  RevisionQueue,
} from "@platform/types";
import {
  readPlans,
  readSubscription,
  type BillingPlan,
  type BillingSubscription,
} from "@/lib/billing/view";
import { ApiError } from "./errors";
import { apiGet } from "./client";

export const loadCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const user: unknown = await apiGet("/api/v1/me", await cookieHeader());
    if (!isCurrentUser(user)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
});

export async function loadAssessment(): Promise<AssessmentView> {
  const body: unknown = await apiGet("/api/v1/assessment", await cookieHeader());
  if (!isAssessment(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body;
}

export async function loadAchievements(): Promise<AchievementList> {
  const body: unknown = await apiGet("/api/v1/achievements", await cookieHeader());
  if (!isAchievementList(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body;
}

export async function loadRevision(): Promise<RevisionQueue> {
  const body: unknown = await apiGet("/api/v1/revision", await cookieHeader());
  if (!isRevisionQueue(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body;
}

export async function loadCatalog(): Promise<LearningCatalog> {
  const catalog: unknown = await apiGet("/api/v1/learning/catalog", await cookieHeader());
  if (!isCatalog(catalog)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return catalog;
}

export async function loadProjects(): Promise<ProjectSummary[]> {
  const body: unknown = await apiGet("/api/v1/projects", await cookieHeader());
  if (!isProjectList(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body.projects;
}

export async function loadProject(projectSlug: string): Promise<ProjectDetail | null> {
  try {
    const body: unknown = await apiGet(
      `/api/v1/projects/${encodeURIComponent(projectSlug)}`,
      await cookieHeader(),
    );
    if (!isProjectDetail(body)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return body.project;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadInterviews(): Promise<InterviewSummary[]> {
  const body: unknown = await apiGet("/api/v1/interviews", await cookieHeader());
  if (!isInterviewList(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body.interviews;
}

export async function loadInterview(slug: string): Promise<InterviewDetail | null> {
  try {
    const body: unknown = await apiGet(
      `/api/v1/interviews/${encodeURIComponent(slug)}`,
      await cookieHeader(),
    );
    if (!isInterviewDetail(body)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return body.interview;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadInterviewSession(
  sessionId: string,
): Promise<InterviewSessionView | null> {
  try {
    const body: unknown = await apiGet(
      `/api/v1/interview-sessions/${encodeURIComponent(sessionId)}`,
      await cookieHeader(),
    );
    if (!isInterviewSession(body)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return body.session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadSpeaking(): Promise<SpeakingPractice> {
  const body: unknown = await apiGet("/api/v1/speaking", await cookieHeader());
  if (!isSpeakingPractice(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body.practice;
}

export async function loadSpeakingSession(sessionId: string): Promise<SpeakingSessionView | null> {
  try {
    const body: unknown = await apiGet(
      `/api/v1/speaking/sessions/${encodeURIComponent(sessionId)}`,
      await cookieHeader(),
    );
    if (!isSpeakingSession(body)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return body.session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadBillingPlans(): Promise<BillingPlan[]> {
  const body: unknown = await apiGet("/api/v1/billing/plans", await cookieHeader());
  const plans = readPlans(body);
  if (plans === null) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return plans;
}

export async function loadBillingSubscription(): Promise<BillingSubscription> {
  const body: unknown = await apiGet("/api/v1/billing/subscription", await cookieHeader());
  const subscription = readSubscription(body);
  if (subscription === null) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return subscription;
}

export async function loadLessonExercises(
  lessonSlug: string,
): Promise<ExerciseListResponse | null> {
  try {
    const body: unknown = await apiGet(
      `/api/v1/lessons/${encodeURIComponent(lessonSlug)}/exercises`,
      await cookieHeader(),
    );
    if (!isExerciseList(body)) {
      throw new ApiError(502, "REQUEST_FAILED");
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

export async function loadHomework(): Promise<HomeworkListResponse> {
  const body: unknown = await apiGet("/api/v1/teaching/homework", await cookieHeader());
  if (!isHomeworkList(body)) {
    throw new ApiError(502, "REQUEST_FAILED");
  }
  return body;
}

async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.email === "string" &&
    typeof value.emailVerified === "boolean" &&
    typeof value.timezone === "string" &&
    (value.name === null || typeof value.name === "string") &&
    isNextAction(value.nextAction)
  );
}

function isAchievementList(value: unknown): value is AchievementList {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.earnedCount !== "number") {
    return false;
  }
  return value.latest === null || isRecord(value.latest);
}

function isRevisionQueue(value: unknown): value is RevisionQueue {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }
  return (
    value.status === "empty" ||
    value.status === "waiting" ||
    value.status === "reviewed" ||
    value.status === "ready"
  );
}

function isCatalog(value: unknown): value is LearningCatalog {
  if (!isRecord(value) || !Array.isArray(value.modules) || !Array.isArray(value.concepts)) {
    return false;
  }
  return isNextAction(value.nextAction);
}

function isHomeworkList(value: unknown): value is HomeworkListResponse {
  return isRecord(value) && Array.isArray(value.homework);
}

function isProjectList(value: unknown): value is ProjectListResponse {
  return isRecord(value) && Array.isArray(value.projects);
}

function isProjectDetail(value: unknown): value is { project: ProjectDetail } {
  return (
    isRecord(value) &&
    isRecord(value.project) &&
    typeof value.project.slug === "string" &&
    typeof value.project.title === "string" &&
    Array.isArray(value.project.milestones)
  );
}

function isInterviewList(value: unknown): value is InterviewListResponse {
  return isRecord(value) && Array.isArray(value.interviews);
}

function isInterviewDetail(value: unknown): value is { interview: InterviewDetail } {
  return (
    isRecord(value) &&
    isRecord(value.interview) &&
    typeof value.interview.slug === "string" &&
    typeof value.interview.title === "string" &&
    Array.isArray(value.interview.history)
  );
}

function isSpeakingPractice(value: unknown): value is { practice: SpeakingPractice } {
  return (
    isRecord(value) &&
    isRecord(value.practice) &&
    typeof value.practice.title === "string" &&
    typeof value.practice.questionCount === "number"
  );
}

function isSpeakingSession(value: unknown): value is { session: SpeakingSessionView } {
  return (
    isRecord(value) &&
    isRecord(value.session) &&
    typeof value.session.id === "string" &&
    typeof value.session.status === "string"
  );
}

function isInterviewSession(value: unknown): value is { session: InterviewSessionView } {
  return (
    isRecord(value) &&
    isRecord(value.session) &&
    typeof value.session.id === "string" &&
    typeof value.session.status === "string"
  );
}

function isAssessment(value: unknown): value is AssessmentView {
  return (
    isRecord(value) &&
    (value.status === "not_required" ||
      value.status === "in_progress" ||
      value.status === "completed" ||
      value.status === "skipped") &&
    typeof value.answered === "number" &&
    typeof value.limit === "number" &&
    (value.item === null || isRecord(value.item)) &&
    (value.result === null || isRecord(value.result))
  );
}

function isExerciseList(value: unknown): value is ExerciseListResponse {
  return isRecord(value) && Array.isArray(value.exercises);
}

function isNextAction(value: unknown): value is NextAction {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  return (
    value.kind === "start_lesson" ||
    value.kind === "continue_lesson" ||
    value.kind === "do_homework" ||
    value.kind === "review_concept" ||
    value.kind === "path_complete"
  );
}
