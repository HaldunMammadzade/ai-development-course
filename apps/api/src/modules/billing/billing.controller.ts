import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { billingCheckoutSchema, billingEmptySchema } from "@platform/validation";
import type { Request } from "express";
import { ValidateBody } from "../../common/validation/zod-body.interceptor";
import { CurrentUser, type AuthenticatedUser } from "../auth/current-user";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { VerifiedEmailGuard } from "../auth/verified-email.guard";
import { safeCorrelationId } from "../../correlation";
import { BillingService } from "./billing.service";

@Controller()
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Get("billing/plans")
  async plans() {
    return { plans: await this.billing.plans() };
  }

  @Get("billing/subscription")
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  async subscription(@CurrentUser() user: AuthenticatedUser) {
    return { subscription: await this.billing.subscription(user.id) };
  }

  @Post("billing/checkout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ValidateBody(billingCheckoutSchema)
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { priceSlug: string; clientCheckoutId: string },
  ) {
    return {
      checkout: await this.billing.checkout(user.id, body.priceSlug, body.clientCheckoutId),
    };
  }

  @Post("billing/cancel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ValidateBody(billingEmptySchema)
  async cancel(@CurrentUser() user: AuthenticatedUser) {
    return { subscription: await this.billing.cancel(user.id) };
  }

  @Post("billing/reactivate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ValidateBody(billingEmptySchema)
  async reactivate(@CurrentUser() user: AuthenticatedUser) {
    return { subscription: await this.billing.reactivate(user.id) };
  }

  @Post("billing/portal")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, VerifiedEmailGuard)
  @ValidateBody(billingEmptySchema)
  async portal() {
    return this.billing.portal();
  }

  @Post("billing/webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() request: Request & { rawBody?: Buffer }) {
    const raw = request.rawBody;
    if (raw === undefined) {
      throw new HttpException(
        { code: "VALIDATION", message: "The payment event was rejected." },
        400,
      );
    }
    return this.billing.webhook(
      raw,
      request.header("x-payment-signature"),
      safeCorrelationId(request.header("x-correlation-id")),
    );
  }
}
