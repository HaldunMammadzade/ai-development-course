import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { CurrentUser as CurrentUserView } from "@platform/types";
import { AuthService } from "./auth.service";
import { CurrentUser, type AuthenticatedUser } from "./current-user";
import { SessionAuthGuard } from "./session-auth.guard";

@Controller()
@UseGuards(SessionAuthGuard)
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserView> {
    return this.auth.profile(user.id);
  }
}
