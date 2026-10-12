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
import type {
  CodeReviewRequest,
  ProjectAttemptRequest,
  ProjectPlanRequest,
} from "@platform/validation";
import {
  codeReviewRequestSchema,
  projectAttemptRequestSchema,
  projectPlanRequestSchema,
} from "@platform/validation";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { ProjectService } from "./project.service";

@Controller("projects")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class ProjectController {
  constructor(@Inject(ProjectService) private readonly projects: ProjectService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): ReturnType<ProjectService["list"]> {
    return this.projects.list(user.id);
  }

  @Get(":projectSlug")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
  ): ReturnType<ProjectService["get"]> {
    return this.projects.get(user.id, projectSlug);
  }

  @Post(":projectSlug/plan")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(projectPlanRequestSchema)
  savePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
    @Body() body: ProjectPlanRequest,
  ): ReturnType<ProjectService["savePlan"]> {
    return this.projects.savePlan(user.id, projectSlug, body);
  }

  @Post(":projectSlug/plan/review")
  @HttpCode(HttpStatus.OK)
  reviewPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
  ): ReturnType<ProjectService["reviewPlan"]> {
    return this.projects.reviewPlan(user.id, projectSlug);
  }

  @Post(":projectSlug/milestones/:milestoneSlug/attempts")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(projectAttemptRequestSchema)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
    @Param("milestoneSlug") milestoneSlug: string,
    @Body() body: ProjectAttemptRequest,
  ): ReturnType<ProjectService["submit"]> {
    return this.projects.submit(user.id, projectSlug, milestoneSlug, body);
  }

  @Get(":projectSlug/milestones/:milestoneSlug/attempts")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
    @Param("milestoneSlug") milestoneSlug: string,
  ): ReturnType<ProjectService["history"]> {
    return this.projects.history(user.id, projectSlug, milestoneSlug);
  }

  @Post(":projectSlug/milestones/:milestoneSlug/review")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(codeReviewRequestSchema)
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectSlug") projectSlug: string,
    @Param("milestoneSlug") milestoneSlug: string,
    @Body() body: CodeReviewRequest,
  ): ReturnType<ProjectService["review"]> {
    return this.projects.review(user.id, projectSlug, milestoneSlug, body);
  }
}
