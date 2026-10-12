import { HttpStatus, type ArgumentsHost } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function captureHost(): { host: ArgumentsHost; status: () => number; body: () => unknown } {
  let statusCode = 0;
  let payload: unknown;

  const host = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(body: unknown) {
          payload = body;
        },
      }),
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    status: () => statusCode,
    body: () => payload,
  };
}

describe("AllExceptionsFilter", () => {
  it("hides unexpected error details in production", () => {
    const filter = new AllExceptionsFilter("production");
    const captured = captureHost();

    filter.catch(new Error("unexpected failure"), captured.host);

    expect(captured.status()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body()).toEqual({
      error: {
        code: "INTERNAL",
        message: "Something went wrong.",
      },
    });
  });

  it("maps a database failure to a safe 503", () => {
    const filter = new AllExceptionsFilter("production");
    const captured = captureHost();
    const failure = new Error(
      "Can't reach database server at postgresql://postgres:secret@db:5432/platform",
    );
    Object.defineProperty(failure, "name", { value: "PrismaClientInitializationError" });
    Object.defineProperty(failure.constructor, "name", {
      value: "PrismaClientInitializationError",
    });

    filter.catch(failure, captured.host);

    expect(captured.status()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(captured.body()).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The service is temporarily unavailable.",
      },
    });
    expect(JSON.stringify(captured.body())).not.toContain("secret");
    expect(JSON.stringify(captured.body())).not.toContain("postgresql://");
  });
});
