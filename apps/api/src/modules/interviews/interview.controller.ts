import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { InterviewAnswerRequest } from "@platform/validation";
import { interviewAnswerRequestSchema, interviewSessionRequestSchema } from "@platform/validation";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { InterviewService } from "./interview.service";

@Controller()
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class InterviewController {
  constructor(@Inject(InterviewService) private readonly interviews: InterviewService) {}

  @Get("interviews")
  list(@CurrentUser() user: AuthenticatedUser): ReturnType<InterviewService["list"]> {
    return this.interviews.list(user.id);
  }

  @Get("interviews/:slug")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string,
  ): ReturnType<InterviewService["get"]> {
    return this.interviews.get(user.id, slug);
  }

  @Post("interviews/:slug/sessions")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(interviewSessionRequestSchema)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string,
  ): ReturnType<InterviewService["start"]> {
    return this.interviews.start(user.id, slug);
  }

  @Get("interview-sessions/:id")
  session(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): ReturnType<InterviewService["session"]> {
    return this.interviews.session(user.id, id);
  }

  @Post("interview-sessions/:id/answers")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(interviewAnswerRequestSchema)
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: InterviewAnswerRequest,
  ): ReturnType<InterviewService["answer"]> {
    return this.interviews.answer(user.id, id, body);
  }

  @Post("interview-sessions/:id/abandon")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(interviewSessionRequestSchema)
  abandon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): ReturnType<InterviewService["abandon"]> {
    return this.interviews.abandon(user.id, id);
  }

  @Get("interview-sessions/:id/report")
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): ReturnType<InterviewService["report"]> {
    return this.interviews.report(user.id, id);
  }
}
