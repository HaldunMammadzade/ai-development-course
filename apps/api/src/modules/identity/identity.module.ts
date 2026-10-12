import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError, type NodeEnv } from "@platform/config";
import { createIdentityRepository, type IdentityRepository } from "@platform/database";
import { IDENTITY_REPOSITORY } from "./identity.repository";
import { IdentityService } from "./identity.service";
import { PasswordService } from "./password.service";
import { SESSION_CONTEXT, SessionService, type SessionContext } from "./session.service";

@Injectable()
class IdentityRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  providers: [
    PasswordService,
    IdentityService,
    SessionService,
    {
      provide: IDENTITY_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailableIdentityRepository();
        }
        return createIdentityRepository(databaseUrl);
      },
    },
    {
      provide: SESSION_CONTEXT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SessionContext => {
        const nodeEnv = config.get<NodeEnv>("nodeEnv");
        if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
          throw new ConfigError("NODE_ENV is required.");
        }
        const cookieDomain = config.get<string | undefined>("cookieDomain");
        return cookieDomain === undefined || cookieDomain.length === 0
          ? { nodeEnv }
          : { nodeEnv, cookieDomain };
      },
    },
    IdentityRepositoryLifecycle,
  ],
  exports: [PasswordService, IdentityService, SessionService, IDENTITY_REPOSITORY],
})
export class IdentityModule {}

function unavailableIdentityRepository(): IdentityRepository {
  const fail = (): Promise<never> => {
    return Promise.reject(new ConfigError("DATABASE_URL is required to use identity."));
  };
  return {
    createUser: fail,
    registerStudent: fail,
    ensureStudentOnboarding: fail,
    findUserByEmail: fail,
    findUserById: fail,
    accountRole: fail,
    findPreferences: fail,
    findStudentAccount: fail,
    loadNextActionContext: fail,
    loadLearningCatalog: fail,
    loadAchievementFacts: fail,
    countOnboarding: fail,
    updateUserStatus: fail,
    deleteUsersByEmailPrefix: fail,
    insertSession: fail,
    findSessionByTokenHash: fail,
    revokeSession: fail,
    revokeSessionByTokenHash: fail,
    updateSessionActivity: fail,
    insertEmailVerificationToken: fail,
    emailVerificationTokenHashes: fail,
    consumeEmailVerificationToken: fail,
    insertPasswordResetToken: fail,
    resetPassword: fail,
    consumeAuthRate: fail,
    disconnect: () => Promise.resolve(),
  };
}
