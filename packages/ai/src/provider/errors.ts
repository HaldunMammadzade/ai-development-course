export const AI_PROVIDER_ERROR_CODES = [
  "authentication",
  "rate_limit",
  "timeout",
  "unavailable",
  "invalid_response",
  "malformed_json",
  "safety_refusal",
  "input_too_large",
  "unknown",
] as const;

export type AIProviderErrorCode = (typeof AI_PROVIDER_ERROR_CODES)[number];

export const AI_FAILURE_CATEGORIES = [
  "provider_http_error",
  "empty_provider_response",
  "malformed_json",
  "teacher_schema_rejection",
  "schema_rejection",
  "internal_leak_rejection",
  "full_solution_rejection",
  "unknown_ai_failure",
] as const;

export type AiFailureCategory = (typeof AI_FAILURE_CATEGORIES)[number];

export interface AiSchemaIssue {
  path: string;
  code: string;
}

export interface AiFailureDetails {
  httpStatus?: number | null;
  failureCategory?: AiFailureCategory | null;
  schemaIssues?: readonly AiSchemaIssue[];
}

const ISSUE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SCHEMA_ISSUES = 8;

const SAFE_MESSAGES: Record<AIProviderErrorCode, string> = {
  authentication: "AI provider is not configured.",
  rate_limit: "AI provider is busy.",
  timeout: "AI provider timed out.",
  unavailable: "AI provider is unavailable.",
  invalid_response: "AI provider returned an invalid response.",
  malformed_json: "AI provider returned malformed JSON.",
  safety_refusal: "AI provider refused the request.",
  input_too_large: "The teaching request is too large.",
  unknown: "AI provider failed.",
};

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly httpStatus: number | null;
  readonly failureCategory: AiFailureCategory | null;
  readonly schemaIssues: readonly AiSchemaIssue[];

  constructor(code: AIProviderErrorCode, details: AiFailureDetails = {}) {
    super(SAFE_MESSAGES[code]);
    this.name = "AIProviderError";
    this.code = code;
    this.httpStatus = details.httpStatus ?? null;
    this.failureCategory = details.failureCategory ?? null;
    this.schemaIssues = sanitizeSchemaIssues(details.schemaIssues ?? []);
  }
}

function sanitizeSchemaIssues(issues: readonly AiSchemaIssue[]): AiSchemaIssue[] {
  const accepted: AiSchemaIssue[] = [];
  for (const issue of issues) {
    if (accepted.length >= MAX_SCHEMA_ISSUES || !ISSUE_TOKEN.test(issue.code)) {
      continue;
    }
    const parts = issue.path.length === 0 ? [] : issue.path.split(".");
    if (parts.some((part) => !ISSUE_TOKEN.test(part))) {
      continue;
    }
    accepted.push({ path: parts.join("."), code: issue.code });
  }
  return accepted;
}

export function providerErrorCode(status: number, bodyText: string): AIProviderErrorCode {
  if (status === 401 || status === 403) {
    return "authentication";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status === 408) {
    return "timeout";
  }
  if (status >= 500) {
    return "unavailable";
  }
  if (isSafetyRefusal(bodyText)) {
    return "safety_refusal";
  }
  if (status >= 400) {
    return "invalid_response";
  }
  return "unknown";
}

export function moduleSchemaRejection(
  schemaIssues: readonly AiSchemaIssue[] = [],
): AIProviderError {
  return new AIProviderError("invalid_response", {
    failureCategory: "schema_rejection",
    schemaIssues,
  });
}

export function moduleLeakRejection(): AIProviderError {
  return new AIProviderError("invalid_response", { failureCategory: "internal_leak_rejection" });
}

export function moduleSolutionRejection(): AIProviderError {
  return new AIProviderError("invalid_response", { failureCategory: "full_solution_rejection" });
}

function isSafetyRefusal(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  return text.includes("content_filter") || text.includes("safety") || text.includes("refusal");
}
