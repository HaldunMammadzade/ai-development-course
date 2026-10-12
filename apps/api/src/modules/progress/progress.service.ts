import { Inject, Injectable } from "@nestjs/common";
import type { MasteryProjection } from "@platform/curriculum";
import type { NewLearningEvent, ProgressRepository, WeakConceptRow } from "@platform/database";
import { PROGRESS_REPOSITORY } from "./progress.repository";

@Injectable()
export class ProgressService {
  constructor(@Inject(PROGRESS_REPOSITORY) private readonly repository: ProgressRepository) {}

  recordLearningEvent(input: NewLearningEvent): Promise<{ id: string }> {
    return this.repository.recordLearningEvent(input);
  }

  rebuildSkillMastery(input: {
    userId: string;
    conceptId: string;
    now: Date;
    timeZone: string;
  }): Promise<MasteryProjection | null> {
    return this.repository.rebuildSkillMastery(input);
  }

  listWeakConcepts(userId: string): Promise<WeakConceptRow[]> {
    return this.repository.listWeakConcepts(userId);
  }
}
