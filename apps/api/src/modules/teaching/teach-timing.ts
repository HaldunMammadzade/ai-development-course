export const TEACH_TIMING_EVENT = "teach_timing";

export type TeachTimingOutcome = "success" | "error" | "timeout" | "replay";

export interface TeachSchemaIssue {
  path: string;
  code: string;
}

export interface TeachTimingEvent {
  event: typeof TEACH_TIMING_EVENT;
  correlationId: string;
  outcome: TeachTimingOutcome;
  error: string | null;
  http_status: number | null;
  schema_issues: TeachSchemaIssue[];
  provider: string | null;
  model: string | null;
  prepare_ms: number | null;
  prompt_ms: number | null;
  provider_ms: number | null;
  commit_ms: number | null;
  total_ms: number;
}

export function elapsedMs(started: number, ended: number): number {
  if (!Number.isFinite(started) || !Number.isFinite(ended)) {
    return 0;
  }
  const duration = ended - started;
  return duration < 0 ? 0 : duration;
}

export function teachTimingEvent(input: {
  correlationId: string;
  outcome: TeachTimingOutcome;
  error: string | null;
  httpStatus: number | null;
  schemaIssues: readonly TeachSchemaIssue[];
  provider: string | null;
  model: string | null;
  prepareMs: number | null;
  promptMs: number | null;
  providerMs: number | null;
  commitMs: number | null;
  totalMs: number;
}): TeachTimingEvent {
  return {
    event: TEACH_TIMING_EVENT,
    correlationId: input.correlationId,
    outcome: input.outcome,
    error: input.error,
    http_status: input.httpStatus,
    schema_issues: input.schemaIssues.map((issue) => ({ path: issue.path, code: issue.code })),
    provider: input.provider,
    model: input.model,
    prepare_ms: input.prepareMs,
    prompt_ms: input.promptMs,
    provider_ms: input.providerMs,
    commit_ms: input.commitMs,
    total_ms: input.totalMs < 0 ? 0 : input.totalMs,
  };
}
