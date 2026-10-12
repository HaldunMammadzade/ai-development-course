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
import type { CodeReviewRequest, ExerciseAttemptRequest } from "@platform/validation";
import { codeReviewRequestSchema, exerciseAttemptRequestSchema } from "@platform/validation";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { ExerciseService } from "./exercise.service";

@Controller("exercises")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class ExerciseController {
  constructor(@Inject(ExerciseService) private readonly exercises: ExerciseService) {}

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") exerciseId: string,
  ): ReturnType<ExerciseService["get"]> {
    return this.exercises.get(user.id, exerciseId);
  }

  @Post(":id/attempts")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(exerciseAttemptRequestSchema)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") exerciseId: string,
    @Body() body: ExerciseAttemptRequest,
  ): ReturnType<ExerciseService["submit"]> {
    return this.exercises.submit(user.id, exerciseId, body);
  }

  @Post(":id/review")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(codeReviewRequestSchema)
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") exerciseId: string,
    @Body() body: CodeReviewRequest,
  ): ReturnType<ExerciseService["review"]> {
    return this.exercises.review(user.id, exerciseId, body);
  }

  @Get(":id/attempts")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") exerciseId: string,
  ): ReturnType<ExerciseService["history"]> {
    return this.exercises.history(user.id, exerciseId);
  }
}

@Controller("lessons")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class LessonExerciseController {
  constructor(@Inject(ExerciseService) private readonly exercises: ExerciseService) {}

  @Get(":slug/exercises")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") lessonSlug: string,
  ): ReturnType<ExerciseService["listForLesson"]> {
    return this.exercises.listForLesson(user.id, lessonSlug);
  }
}
