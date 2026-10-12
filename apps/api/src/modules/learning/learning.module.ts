import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LearningCatalogService } from "./learning-catalog.service";
import { AchievementsController } from "./achievements.controller";
import { LearningController } from "./learning.controller";
import { RevisionController } from "./revision.controller";

@Module({
  imports: [AuthModule],
  controllers: [LearningController, RevisionController, AchievementsController],
  providers: [LearningCatalogService],
})
export class LearningModule {}
