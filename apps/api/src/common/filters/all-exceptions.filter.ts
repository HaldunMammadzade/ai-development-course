import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { NodeEnv } from "@platform/config";
import type { ApiErrorBody } from "@platform/types";
import { parseApiErrorBody } from "@platform/validation";
import type { Response } from "express";

const FALLBACK_BODY: ApiErrorBody = {
  error: {
    code: "INTERNAL",
    message: "Something went wrong.",
  },
};

function codeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "VALIDATION";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHENTICATED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR ? "INTERNAL" : "REQUEST_FAILED";
  }
}

function readExceptionBody(exception: HttpException): {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
} {
  const response = exception.getResponse();
  if (typeof response === "string") {
    return { message: response };
  }

  if (typeof response !== "object" || response === null) {
    return {};
  }

  const body = response as Record<string, unknown>;
  const message = Array.isArray(body.message)
    ? body.message.map((item) => String(item)).join(" ")
    : typeof body.message === "string"
      ? body.message
      : undefined;
  const code = typeof body.code === "string" ? body.code : undefined;
  const details =
    typeof body.details === "object" && body.details !== null
      ? (body.details as Record<string, unknown>)
      : undefined;

  return { code, message, details };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly nodeEnv: NodeEnv) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") {
      return;
    }

    const response = host.switchToHttp().getResponse<Response>();
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL";
    let message =
      this.nodeEnv === "production" ? "Something went wrong." : "Internal server error.";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = readExceptionBody(exception);
      code = body.code ?? codeForStatus(status);
      message = body.message ?? message;
      details = body.details;
    } else if (isDatabaseFailure(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = "DATABASE_UNAVAILABLE";
      message = "The service is temporarily unavailable.";
    } else if (
      this.nodeEnv !== "production" &&
      exception instanceof Error &&
      safeDiagnostic(exception.message)
    ) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof HttpException)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      if (this.nodeEnv !== "production" && stack !== undefined && safeDiagnostic(stack)) {
        this.logger.error(stack);
      } else {
        this.logger.error(JSON.stringify({ event: "unhandled", code }));
      }
    }

    const candidate = {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    };

    try {
      const payload = parseApiErrorBody(candidate);
      response.status(status).json(payload);
    } catch {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(FALLBACK_BODY);
    }
  }
}

function isDatabaseFailure(exception: unknown): boolean {
  if (!(exception instanceof Error)) {
    return false;
  }
  if (exception.constructor.name.startsWith("Prisma")) {
    return true;
  }
  return /P1001|P1017|ECONNREFUSED|Can't reach database server/i.test(exception.message);
}

function safeDiagnostic(value: string): boolean {
  return !/postgres(ql)?:\/\//i.test(value) && !value.includes("Bearer ");
}
