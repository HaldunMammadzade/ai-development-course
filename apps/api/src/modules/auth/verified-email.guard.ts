import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { currentUser } from "./current-user";

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = currentUser(request);
    if (user.status !== "active" || user.emailVerifiedAt === null) {
      throw new ForbiddenException({
        code: "EMAIL_UNVERIFIED",
        message: "Verify your email before starting a lesson.",
      });
    }
    return true;
  }
}
