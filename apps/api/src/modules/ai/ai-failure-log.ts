import {
  AIProviderError,
  AiConfigurationError,
  AiTaskUnavailableError,
  SpeechUnavailableError,
} from "@platform/ai";

const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

export interface AiFailureLog {
  category: string;
  httpStatus: number | null;
  schemaIssues: readonly { path: string; code: string }[];
}

export function describeAiFailure(error: unknown): AiFailureLog {
  if (error instanceof AIProviderError) {
    return {
      category: token(error.failureCategory ?? error.code),
      httpStatus: httpStatus(error.httpStatus),
      schemaIssues: error.schemaIssues
        .filter((issue) => TOKEN.test(issue.path) && TOKEN.test(issue.code))
        .map((issue) => ({ path: issue.path, code: issue.code })),
    };
  }
  if (error instanceof AiConfigurationError) {
    return { category: "configuration", httpStatus: null, schemaIssues: [] };
  }
  if (error instanceof AiTaskUnavailableError) {
    return { category: "task_unavailable", httpStatus: null, schemaIssues: [] };
  }
  if (error instanceof SpeechUnavailableError) {
    return {
      category: token(error.failureCategory ?? "unknown"),
      httpStatus: httpStatus(error.httpStatus),
      schemaIssues: error.schemaIssues
        .filter((issue) => TOKEN.test(issue.path) && TOKEN.test(issue.code))
        .map((issue) => ({ path: issue.path, code: issue.code })),
    };
  }
  return { category: "unknown", httpStatus: null, schemaIssues: [] };
}

export function aiFailureLogSuffix(error: unknown): string {
  const failure = describeAiFailure(error);
  const issues =
    failure.schemaIssues.length === 0
      ? ""
      : ` schema_issues=${failure.schemaIssues.map((issue) => `${issue.path}:${issue.code}`).join(",")}`;
  const status = failure.httpStatus === null ? "null" : String(failure.httpStatus);
  return `category=${failure.category} http_status=${status}${issues}`;
}

function token(value: string): string {
  return TOKEN.test(value) ? value : "unknown";
}

function httpStatus(status: number | null): number | null {
  if (status === null || !Number.isInteger(status) || status < 100 || status > 599) {
    return null;
  }
  return status;
}
