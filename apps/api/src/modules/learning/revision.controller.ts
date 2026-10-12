import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { RevisionQueue } from "@platform/types";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { LearningCatalogService } from "./learning-catalog.service";

@Controller("revision")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class RevisionController {
  constructor(@Inject(LearningCatalogService) private readonly catalog: LearningCatalogService) {}

  @Get()
  queue(@CurrentUser() user: AuthenticatedUser): Promise<RevisionQueue> {
    return this.catalog.revision(user.id);
  }
}
