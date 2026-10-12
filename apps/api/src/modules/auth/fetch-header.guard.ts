import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class FetchHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }
    const path = `${request.originalUrl} ${request.path}`;
    if (path.includes("/billing/webhook")) {
      return true;
    }
    if (request.header("x-requested-with") === "fetch") {
      return true;
    }
    throw new ForbiddenException({
      code: "CSRF",
      message: "This request was rejected.",
    });
  }
}
