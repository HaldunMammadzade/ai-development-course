import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { IdentityModule } from "../identity/identity.module";
import { OpsModule } from "../ops/ops.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FetchHeaderGuard } from "./fetch-header.guard";
import { MeController } from "./me.controller";
import { SessionAuthGuard } from "./session-auth.guard";
import { VerifiedEmailGuard } from "./verified-email.guard";

@Module({
  imports: [IdentityModule, OpsModule],
  controllers: [AuthController, MeController],
  exports: [IdentityModule, SessionAuthGuard, VerifiedEmailGuard],
  providers: [
    AuthService,
    SessionAuthGuard,
    VerifiedEmailGuard,
    { provide: APP_GUARD, useClass: FetchHeaderGuard },
  ],
})
export class AuthModule {}
