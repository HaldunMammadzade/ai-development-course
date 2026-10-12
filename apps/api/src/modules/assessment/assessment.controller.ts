import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Body, UseGuards } from "@nestjs/common";
import type { AssessmentView } from "@platform/types";
import type { AssessmentAnswerInput } from "@platform/validation";
import { assessmentAnswerSchema } from "@platform/validation";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { AssessmentService } from "./assessment.service";

@Controller("assessment")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class AssessmentController {
  constructor(@Inject(AssessmentService) private readonly assessment: AssessmentService) {}

  @Get()
  view(@CurrentUser() user: AuthenticatedUser): Promise<AssessmentView> {
    return this.assessment.view(user.id);
  }

  @Post("answers")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(assessmentAnswerSchema)
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssessmentAnswerInput,
  ): Promise<AssessmentView> {
    return this.assessment.answer(user.id, body);
  }

  @Post("skip")
  @HttpCode(HttpStatus.OK)
  skip(@CurrentUser() user: AuthenticatedUser): Promise<AssessmentView> {
    return this.assessment.skip(user.id);
  }
}
