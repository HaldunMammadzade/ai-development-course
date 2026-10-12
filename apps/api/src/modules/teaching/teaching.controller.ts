import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { OpenTeachingSessionInput, TeachingTurnInput } from "@platform/validation";
import { openTeachingSessionSchema, teachingTurnSchema } from "@platform/validation";
import type { Request, Response } from "express";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { TeachingOrchestrator } from "./teaching.orchestrator";

const CORRELATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Controller("teaching/sessions")
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class TeachingController {
  constructor(@Inject(TeachingOrchestrator) private readonly teaching: TeachingOrchestrator) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ValidateBody(openTeachingSessionSchema)
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: OpenTeachingSessionInput,
  ): ReturnType<TeachingOrchestrator["open"]> {
    return this.teaching.open(user.id, body.mode ?? "explain");
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") sessionId: string,
  ): ReturnType<TeachingOrchestrator["get"]> {
    return this.teaching.get(user.id, sessionId);
  }

  @Post(":id/abandon")
  @HttpCode(HttpStatus.OK)
  abandon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") sessionId: string,
  ): ReturnType<TeachingOrchestrator["abandon"]> {
    return this.teaching.abandon(user.id, sessionId);
  }

  @Post(":id/turns")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(teachingTurnSchema)
  turn(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") sessionId: string,
    @Body() body: TeachingTurnInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): ReturnType<TeachingOrchestrator["turn"]> {
    return this.teaching.turn({
      userId: user.id,
      sessionId,
      clientTurnId: body.clientTurnId,
      message: body.message,
      advance: body.advance === true,
      correlationId: correlationId(request, response),
    });
  }
}

function correlationId(request: Request, response: Response): string {
  const current = response.getHeader("x-correlation-id");
  if (typeof current === "string" && CORRELATION_ID.test(current)) {
    return current;
  }
  const incoming = request.header("x-correlation-id");
  if (incoming !== undefined && CORRELATION_ID.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}
