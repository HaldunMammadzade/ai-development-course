import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { ZodType } from "zod";
import { parseRequestBody } from "./parse-request-body";

export const ZOD_BODY_SCHEMA = "zod_body_schema";

export function ValidateBody(schema: ZodType): MethodDecorator {
  return SetMetadata(ZOD_BODY_SCHEMA, schema);
}

@Injectable()
export class ZodBodyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): ReturnType<CallHandler["handle"]> {
    const schema = this.reflector.get<ZodType | undefined>(ZOD_BODY_SCHEMA, context.getHandler());
    if (schema !== undefined && context.getType() === "http") {
      const request = context.switchToHttp().getRequest<Request>();
      request.body = parseRequestBody(schema, request.body);
    }

    return next.handle();
  }
}
