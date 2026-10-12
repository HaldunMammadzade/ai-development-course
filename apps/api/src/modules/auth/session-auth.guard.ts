import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SESSION_COOKIE_NAME } from "@platform/config";
import type { Request } from "express";
import { IdentityService } from "../identity/identity.service";
import { SessionRejectedError, SessionService } from "../identity/session.service";
import { attachUser } from "./current-user";
import { readCookie } from "./cookies";

const UNAUTHENTICATED = {
  code: "UNAUTHENTICATED",
  message: "Sign in to continue.",
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (token === null || token.length === 0) {
      throw new UnauthorizedException(UNAUTHENTICATED);
    }

    try {
      const session = await this.sessions.resolveSession(token);
      const user = await this.identity.findById(session.userId);
      if (user === null || user.status !== "active") {
        throw new UnauthorizedException(UNAUTHENTICATED);
      }
      attachUser(request, {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        timezone: user.timezone,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status,
        sessionId: session.sessionId,
      });
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof SessionRejectedError) {
        throw new UnauthorizedException(UNAUTHENTICATED);
      }
      throw error;
    }
  }
}
