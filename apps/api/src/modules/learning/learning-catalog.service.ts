import { Inject, Injectable } from "@nestjs/common";
import { buildAchievements, presentLearningCatalog } from "@platform/curriculum";
import type { IdentityRepository } from "@platform/database";
import type { AchievementList, LearningCatalog } from "@platform/types";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";

@Injectable()
export class LearningCatalogService {
  constructor(@Inject(IDENTITY_REPOSITORY) private readonly identity: IdentityRepository) {}

  async catalog(userId: string, now = new Date()): Promise<LearningCatalog> {
    const source = await this.identity.loadLearningCatalog(userId);
    return presentLearningCatalog({
      now,
      path: source.path,
      modules: source.modules,
      concepts: source.concepts,
      context: source.context,
      activity: source.activity ?? [],
      evidence: source.evidence ?? [],
      revisionSuccesses: source.revisionSuccesses ?? [],
      revisionExercises: source.revisionExercises ?? [],
    });
  }

  async revision(userId: string, now = new Date()) {
    const catalog = await this.catalog(userId, now);
    return catalog.revision ?? { status: "empty" as const, items: [] };
  }

  async achievements(userId: string): Promise<AchievementList> {
    return buildAchievements(await this.identity.loadAchievementFacts(userId));
  }
}
