import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { createAdminAnalytics, type AdminAnalytics } from "@platform/database";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { ADMIN_ANALYTICS } from "./admin.tokens";

@Injectable()
class AdminAnalyticsLifecycle implements OnModuleDestroy {
  constructor(@Inject(ADMIN_ANALYTICS) private readonly analytics: AdminAnalytics) {}

  async onModuleDestroy(): Promise<void> {
    await this.analytics.disconnect();
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminGuard,
    {
      provide: ADMIN_ANALYTICS,
      useFactory: (): AdminAnalytics => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined || databaseUrl.length === 0) {
          return unavailableAdminAnalytics();
        }
        return createAdminAnalytics(databaseUrl);
      },
    },
    AdminAnalyticsLifecycle,
  ],
})
export class AdminModule {}

function unavailableAdminAnalytics(): AdminAnalytics {
  const fail = async () => {
    throw new Error("Admin storage is not configured.");
  };
  return {
    overview: fail,
    learning: fail,
    ai: fail,
    billing: fail,
    system: fail,
    searchStudents: fail,
    studentDetail: fail,
    audit: fail,
    disconnect: async () => undefined,
  };
}
