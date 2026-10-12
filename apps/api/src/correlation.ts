import { randomUUID } from "node:crypto";

export const CORRELATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function safeCorrelationId(incoming: string | undefined): string {
  return incoming !== undefined && CORRELATION_ID.test(incoming) ? incoming : randomUUID();
}
