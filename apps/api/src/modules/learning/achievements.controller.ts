import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { AchievementList } from "@platform/types";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { LearningCatalogService } from "./learning-catalog.service";

@Controller("achievements")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class AchievementsController {
  constructor(@Inject(LearningCatalogService) private readonly catalog: LearningCatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AchievementList> {
    return this.catalog.achievements(user.id);
  }
}
