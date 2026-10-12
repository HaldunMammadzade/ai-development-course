import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { LearningCatalog } from "@platform/types";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { LearningCatalogService } from "./learning-catalog.service";

@Controller("learning")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class LearningController {
  constructor(@Inject(LearningCatalogService) private readonly catalog: LearningCatalogService) {}

  @Get("catalog")
  catalogForStudent(@CurrentUser() user: AuthenticatedUser): Promise<LearningCatalog> {
    return this.catalog.catalog(user.id);
  }
}
