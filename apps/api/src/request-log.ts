export interface HttpLogFields {
  timestamp: string;
  level: "info";
  service: "api";
  correlationId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  event: "http_request";
}

const SAFE_PATH = /^\/[A-Za-z0-9/_.-]{0,180}$/;

export function httpLog(input: {
  correlationId: string;
  path: string;
  method: string;
  status: number;
  durationMs: number;
  now?: Date;
}): HttpLogFields {
  return {
    timestamp: (input.now ?? new Date()).toISOString(),
    level: "info",
    service: "api",
    correlationId: input.correlationId,
    route: SAFE_PATH.test(input.path) ? input.path : "/redacted",
    method: input.method,
    status: input.status,
    durationMs: input.durationMs,
    event: "http_request",
  };
}
