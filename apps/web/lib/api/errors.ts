import { copy } from "@/lib/copy";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(friendlyApiMessage(status, code));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor() {
    super(copy.errors.network);
    this.name = "NetworkError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function friendlyApiMessage(status: number, code: string): string {
  if (code === "EMAIL_UNVERIFIED") {
    return copy.errors.unverified;
  }
  if (code === "CSRF") {
    return copy.errors.csrf;
  }
  if (code === "SESSION_CLOSED") {
    return copy.errors.sessionClosed;
  }
  if (code === "TURN_IN_PROGRESS") {
    return copy.errors.turnBusy;
  }
  if (code === "HOMEWORK_CLOSED") {
    return copy.errors.homeworkClosed;
  }
  if (code === "QUOTA_EXCEEDED") {
    return copy.errors.quota;
  }
  if (code === "FEATURE_NOT_INCLUDED" || code === "PLAN_REQUIRED" || code === "PAYMENT_REQUIRED") {
    return copy.errors.feature;
  }
  if (code === "PAYMENT_UNAVAILABLE") {
    return copy.errors.payment;
  }
  if (code === "SUBSCRIPTION_ACTIVE" || code === "SUBSCRIPTION_CLOSED") {
    return copy.errors.subscriptionActive;
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return copy.errors.rate;
  }
  if (code === "AI_UNAVAILABLE") {
    return copy.errors.ai;
  }
  if (code === "EXECUTION_UNAVAILABLE") {
    return copy.errors.execution;
  }
  if (code === "EXECUTION_BUSY") {
    return copy.errors.executionBusy;
  }
  if (code === "INTERVIEW_ACTIVE") {
    return copy.interviews.active;
  }
  if (code === "INTERVIEW_CLOSED") {
    return copy.interviews.closed;
  }
  if (code === "INTERVIEW_BUSY") {
    return copy.interviews.busy;
  }
  if (code === "SPEECH_UNAVAILABLE") {
    return copy.speaking.speechDown;
  }
  if (code === "SPEAKING_CLOSED") {
    return copy.speaking.closed;
  }
  if (code === "SPEAKING_BUSY" || code === "SPEAKING_ACTIVE") {
    return copy.speaking.busy;
  }
  if (code === "CONFLICT" && status === 409) {
    return copy.errors.duplicateEmail;
  }
  if (status === 401) {
    return copy.errors.unauthenticated;
  }
  if (status === 403) {
    return copy.errors.forbidden;
  }
  if (status === 404) {
    return copy.errors.notFound;
  }
  if (status === 409) {
    return copy.errors.conflict;
  }
  if (status === 400) {
    return copy.errors.validation;
  }
  return copy.errors.generic;
}

export function loginFailureMessage(error: ApiError): string {
  if (error.code === "EMAIL_UNVERIFIED") {
    return copy.errors.unverified;
  }
  if (error.status === 401) {
    return copy.errors.invalidCredentials;
  }
  return error.message;
}
