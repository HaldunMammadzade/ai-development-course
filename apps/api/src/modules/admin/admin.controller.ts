import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  adminStudentListSchema,
  adminStudentParamsSchema,
  adminWindowSchema,
} from "@platform/validation";
import type { Request } from "express";
import { safeCorrelationId } from "../../correlation";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  async overview(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const window = readWindow(query);
    return this.admin.overview(user.id, window, correlation(request));
  }

  @Get("students")
  async students(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const parsed = adminStudentListSchema.safeParse(query);
    if (!parsed.success) {
      throw invalid();
    }
    return this.admin.students(
      user.id,
      { query: parsed.data.q, limit: parsed.data.limit, cursor: parsed.data.cursor ?? null },
      correlation(request),
    );
  }

  @Get("students/:userId")
  async student(
    @Param() params: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const parsed = adminStudentParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new HttpException({ code: "NOT_FOUND", message: "Not found." }, 404);
    }
    return this.admin.student(user.id, parsed.data.userId, correlation(request));
  }

  @Get("learning")
  async learning(@Query() query: unknown) {
    return this.admin.learning(readWindow(query));
  }

  @Get("ai")
  async ai(@Query() query: unknown) {
    return this.admin.ai(readWindow(query));
  }

  @Get("billing")
  async billing(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.billing(user.id, readWindow(query), correlation(request));
  }

  @Get("system")
  async system(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.admin.system(user.id, readWindow(query), correlation(request));
  }
}

function readWindow(query: unknown): "today" | "7d" | "30d" {
  const parsed = adminWindowSchema.safeParse(query);
  if (!parsed.success) {
    throw invalid();
  }
  return parsed.data.window;
}

function invalid(): BadRequestException {
  return new BadRequestException({ code: "VALIDATION", message: "The admin query is invalid." });
}

function correlation(request: Request): string {
  const header = request.header("x-correlation-id");
  return safeCorrelationId(header);
}
