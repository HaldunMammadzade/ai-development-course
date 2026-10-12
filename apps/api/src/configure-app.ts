import { Logger, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { ConfigError, type ApiEnv } from "@platform/config";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ZodBodyInterceptor } from "./common/validation/zod-body.interceptor";
import { safeCorrelationId } from "./correlation";
import { httpLog } from "./request-log";

const httpLogger = new Logger("http");

function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = safeCorrelationId(req.header("x-correlation-id"));
  res.setHeader("X-Correlation-Id", id);
  const started = Date.now();
  res.on("finish", () => {
    httpLogger.log(
      JSON.stringify(
        httpLog({
          correlationId: id,
          path: req.path,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      ),
    );
  });
  next();
}

export function configureApp(app: INestApplication): ApiEnv {
  const config = app.get(ConfigService);
  const nodeEnv = config.getOrThrow<ApiEnv["nodeEnv"]>("nodeEnv");
  const port = config.getOrThrow<number>("port");
  const databaseUrl = config.get<string | null>("databaseUrl") ?? null;
  const execution = config.getOrThrow<ApiEnv["execution"]>("execution");

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: nodeEnv === "production",
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  enableExplicitCors(app, nodeEnv);
  app.use(correlationId);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new AllExceptionsFilter(nodeEnv));
  app.useGlobalInterceptors(new ZodBodyInterceptor(new Reflector()));
  app.enableShutdownHooks();

  return { nodeEnv, port, databaseUrl, execution };
}

function enableExplicitCors(app: INestApplication, nodeEnv: ApiEnv["nodeEnv"]): void {
  const origin = process.env.WEB_ORIGIN?.trim();
  if (origin === undefined || origin.length === 0) {
    return;
  }
  if (origin === "*" || origin.includes(" ") || origin.includes(",")) {
    throw new ConfigError("WEB_ORIGIN must be one explicit origin.");
  }
  if (nodeEnv === "production" && !origin.startsWith("https://")) {
    throw new ConfigError("WEB_ORIGIN must use https in production.");
  }
  app.enableCors({
    origin,
    credentials: true,
    methods: ["GET", "HEAD", "POST"],
    allowedHeaders: ["content-type", "x-requested-with", "x-correlation-id"],
  });
}
