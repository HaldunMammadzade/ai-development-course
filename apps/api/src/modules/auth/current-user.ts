import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Locale, UserStatus } from "@platform/database";
import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  sessionId: string;
}

export function currentUser(request: Request): AuthenticatedUser {
  const user = (request as Request & { authenticatedUser?: AuthenticatedUser }).authenticatedUser;
  if (user === undefined) {
    throw new UnauthorizedException({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  return user;
}

export function attachUser(request: Request, user: AuthenticatedUser): void {
  (request as Request & { authenticatedUser?: AuthenticatedUser }).authenticatedUser = user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    currentUser(context.switchToHttp().getRequest<Request>()),
);
