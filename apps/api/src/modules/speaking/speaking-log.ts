export function speakingUsageCorrelation(
  correlationId: string | null | undefined,
  fallback: "speaking" | "scripted",
): string {
  if (correlationId === null || correlationId === undefined || correlationId.trim().length === 0) {
    return fallback;
  }
  return correlationId;
}

export function speakingLogLine(input: {
  correlationId: string;
  speakingAttemptId?: string | null;
  status: string;
  durationMs: number;
  detail?: string;
}): string {
  const attemptId = input.speakingAttemptId?.trim() ?? "";
  const attempt = attemptId.length === 0 ? "" : ` speaking_attempt_id=${attemptId}`;
  const line = `speaking correlation=${input.correlationId}${attempt} status=${input.status} durationMs=${input.durationMs}`;
  return input.detail === undefined || input.detail.length === 0 ? line : `${line} ${input.detail}`;
}
