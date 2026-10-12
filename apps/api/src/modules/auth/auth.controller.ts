import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NodeEnv } from "@platform/config";
import {
  loginRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  verifyEmailRequestSchema,
} from "@platform/validation";
import type { Request, Response } from "express";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { AuthService } from "./auth.service";
import { clientAddress } from "./client-address";
import { safeCorrelationId } from "../../correlation";
import { developmentSecretHeader } from "./cookies";
import { SessionAuthGuard } from "./session-auth.guard";
import { VerifiedEmailGuard } from "./verified-email.guard";

const VERIFICATION_HEADER = "X-Development-Verification-Token";
const RESET_HEADER = "X-Development-Password-Reset-Token";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ValidateBody(registerRequestSchema)
  async register(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    id: string;
    email: string;
    name: string | null;
    locale: string;
    timezone: string;
    emailVerified: false;
  }> {
    const result = await this.auth.register(
      request.body,
      clientAddress(request),
      this.correlationId(request, response),
    );
    this.setDevelopmentHeader(response, VERIFICATION_HEADER, result.verificationToken);
    return result.body;
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(verifyEmailRequestSchema)
  verifyEmail(@Req() request: Request): Promise<{ emailVerified: true }> {
    const body = request.body as { token: string };
    return this.auth.verifyEmail(body.token);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(loginRequestSchema)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    id: string;
    email: string;
    name: string | null;
    locale: string;
    timezone: string;
    emailVerified: true;
  }> {
    const result = await this.auth.login(
      request.body,
      request.headers.cookie,
      clientAddress(request),
    );
    this.auth.writeCookie(response, result.cookie);
    return result.body;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookie = await this.auth.logout(request.headers.cookie);
    this.auth.writeCookie(response, cookie);
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @ValidateBody(passwordResetRequestSchema)
  async requestPasswordReset(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: "accepted" }> {
    const body = request.body as { email: string };
    const token = await this.auth.requestPasswordReset(
      body.email,
      clientAddress(request),
      this.correlationId(request, response),
    );
    this.setDevelopmentHeader(response, RESET_HEADER, token);
    return { status: "accepted" };
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  @ValidateBody(passwordResetConfirmSchema)
  confirmPasswordReset(@Req() request: Request): Promise<{ passwordUpdated: true }> {
    const body = request.body as { token: string; password: string };
    return this.auth.confirmPasswordReset(body.token, body.password);
  }

  @Get("teaching-access")
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  teachingAccess(): { allowed: true } {
    return { allowed: true };
  }

  private setDevelopmentHeader(response: Response, name: string, token: string | null): void {
    const header = developmentSecretHeader(this.nodeEnv(), name, token);
    if (header !== null) {
      response.setHeader(header[0], header[1]);
    }
  }

  private correlationId(request: Request, response: Response): string {
    const header = response.getHeader("X-Correlation-Id");
    if (typeof header === "string" && header.length > 0) {
      return header;
    }
    return safeCorrelationId(request.header("x-correlation-id"));
  }

  private nodeEnv(): NodeEnv {
    const nodeEnv = this.config.get<NodeEnv>("nodeEnv");
    if (nodeEnv === "development" || nodeEnv === "test") {
      return nodeEnv;
    }
    return "production";
  }
}
