import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigError, loadPaymentEnv } from "@platform/config";
import { createBillingRepository, type BillingRepository } from "@platform/database";
import { AuthModule } from "../auth/auth.module";
import { OpsModule } from "../ops/ops.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BILLING_REPOSITORY, PAYMENT_PROVIDER } from "./billing.tokens";
import { HttpPaymentProvider } from "./http-payment";
import {
  DisabledPaymentProvider,
  FakePaymentProvider,
  type PaymentProvider,
} from "./payment-provider";

@Injectable()
class BillingRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(BILLING_REPOSITORY) private readonly repository: BillingRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, OpsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: BILLING_REPOSITORY,
      useFactory: (): BillingRepository => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined || databaseUrl.length === 0) {
          return unavailableBillingRepository();
        }
        return createBillingRepository(databaseUrl);
      },
    },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (): PaymentProvider => {
        const config = loadPaymentEnv(process.env);
        if (config === null) {
          return new DisabledPaymentProvider();
        }
        if (config.provider === "fake") {
          if (process.env.NODE_ENV === "production") {
            throw new ConfigError("PAYMENT_PROVIDER is not allowed in production.");
          }
          return new FakePaymentProvider(config.webhookSecret);
        }
        return new HttpPaymentProvider(config);
      },
    },
    BillingRepositoryLifecycle,
  ],
})
export class BillingModule {}

function unavailableBillingRepository(): BillingRepository {
  const fail = async () => {
    throw new Error("Billing storage is not configured.");
  };
  return {
    listPlans: async () => [],
    subscription: fail,
    checkout: fail,
    cancel: fail,
    reactivate: fail,
    applyEvent: fail,
    reconcile: async () => undefined,
    disconnect: async () => undefined,
  };
}
