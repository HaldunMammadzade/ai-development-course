export function billingLogLine(input: {
  correlationId: string;
  provider: string;
  eventType: string;
  status: string;
  durationMs: number;
}): string {
  return `billing correlation=${input.correlationId} provider=${input.provider} event=${input.eventType} status=${input.status} durationMs=${input.durationMs}`;
}
