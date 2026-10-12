import { Inject, Injectable } from "@nestjs/common";
import type { CurriculumRepository, StoredLearningPath } from "@platform/database";
import { CURRICULUM_REPOSITORY } from "./curriculum.repository";

@Injectable()
export class CurriculumService {
  constructor(@Inject(CURRICULUM_REPOSITORY) private readonly repository: CurriculumRepository) {}

  async getPublishedPath(slug: string): Promise<StoredLearningPath | null> {
    const path = await this.repository.findPathBySlug(slug);
    if (path === null || path.status !== "published") {
      return null;
    }
    return path;
  }

  findDirectPrerequisiteSlugs(conceptSlug: string): Promise<string[]> {
    return this.repository.findDirectPrerequisiteSlugs(conceptSlug);
  }
}
