import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { TeachingOrchestrator } from "./teaching.orchestrator";

@Controller("teaching/homework")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class TeachingHomeworkController {
  constructor(@Inject(TeachingOrchestrator) private readonly teaching: TeachingOrchestrator) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): ReturnType<TeachingOrchestrator["listHomework"]> {
    return this.teaching.listHomework(user.id);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") homeworkId: string,
  ): ReturnType<TeachingOrchestrator["completeHomework"]> {
    return this.teaching.completeHomework(user.id, homeworkId);
  }
}
