import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { SpeakingSessionView } from "@platform/types";
import {
  speakingAbandonSchema,
  speakingStartSchema,
  speakingTextSchema,
} from "@platform/validation";
import type { Request } from "express";
import { parseRequestBody } from "../../common/validation/parse-request-body";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { parseSpeakingUpload, UploadValidationError } from "./audio-upload";
import { SpeakingService } from "./speaking.service";

const MAX_BODY_BYTES = 8 * 1024 * 1024 + 64 * 1024;

@Controller()
@UseGuards(SessionAuthGuard, VerifiedEmailGuard)
export class SpeakingController {
  constructor(@Inject(SpeakingService) private readonly speaking: SpeakingService) {}

  @Get("speaking")
  async practice(@CurrentUser() user: AuthenticatedUser) {
    return { practice: await this.speaking.practice(user.id) };
  }

  @Post("speaking/sessions")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(speakingStartSchema)
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { mode: "lesson" | "interview" },
  ) {
    return { session: await this.speaking.start(user.id, body.mode) };
  }

  @Get("speaking/sessions/:id")
  async session(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { session: await this.speaking.session(user.id, id) };
  }

  @Post("speaking/sessions/:id/attempts")
  @HttpCode(HttpStatus.OK)
  async attempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
  ): Promise<{ session: SpeakingSessionView }> {
    const type = request.header("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const body = await readRaw(request, MAX_BODY_BYTES);
      let parsed;
      try {
        parsed = parseSpeakingUpload(type, body);
      } catch (error) {
        if (error instanceof UploadValidationError) {
          throw new HttpException(
            { code: error.code, message: "The recording was rejected." },
            400,
          );
        }
        throw error;
      }
      return {
        session: await this.speaking.answer(user.id, id, {
          clientAttemptId: parsed.clientAttemptId,
          text: parsed.text,
          audio: parsed.audio,
        }),
      };
    }
    const parsed = parseRequestBody(speakingTextSchema, request.body) as {
      clientAttemptId: string;
      text: string;
    };
    return {
      session: await this.speaking.answer(user.id, id, {
        clientAttemptId: parsed.clientAttemptId,
        text: parsed.text,
        audio: null,
      }),
    };
  }

  @Post("speaking/sessions/:id/abandon")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(speakingAbandonSchema)
  async abandon(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { session: await this.speaking.abandon(user.id, id) };
  }
}

async function readRaw(request: Request, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > max) {
      throw new HttpException(
        { code: "AUDIO_TOO_LARGE", message: "The recording was rejected." },
        400,
      );
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
