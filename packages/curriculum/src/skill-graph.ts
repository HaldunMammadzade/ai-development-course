import type {
  LearningActivitySource,
  LessonAvailability,
  MasteryBand,
  PersonalizedPath,
  RevisionIndicator,
  SkillGraph,
  SkillGraphConcept,
  SkillGraphModule,
  SkillGraphRelation,
  SkillState,
} from "@platform/types";
import { masteryBand } from "./mastery";

export interface SkillGraphConceptInput {
  slug: string;
  name: string;
  summary: string;
  moduleSlug: string;
  moduleTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonAvailability: LessonAvailability;
  band: MasteryBand | null;
  evidenceSource: LearningActivitySource | null;
  revision?: RevisionIndicator | null;
}

export function skillState(band: MasteryBand | null): SkillState {
  switch (band) {
    case null:
      return "unknown";
    case "weak":
      return "weak";
    case "strong":
      return "strong";
    case "fragile":
    case "working":
      return "developing";
  }
}

export function skillStateFromEvidence(score: number, evidenceCount: number): SkillState {
  return skillState(masteryBand(score, evidenceCount));
}

export function buildSkillGraph(input: {
  concepts: readonly SkillGraphConceptInput[];
  prerequisites: readonly { conceptSlug: string; prerequisiteSlug: string }[];
  path: PersonalizedPath | null;
}): SkillGraph {
  const ordered: SkillGraphConceptInput[] = [];
  const seen = new Set<string>();
  for (const concept of input.concepts) {
    if (seen.has(concept.slug)) {
      continue;
    }
    seen.add(concept.slug);
    ordered.push(concept);
  }
  const bySlug = new Map(ordered.map((concept) => [concept.slug, concept]));
  const prerequisitesOf = new Map<string, SkillGraphRelation[]>();
  const dependentsOf = new Map<string, SkillGraphRelation[]>();
  for (const slug of seen) {
    prerequisitesOf.set(slug, []);
    dependentsOf.set(slug, []);
  }
  const edges = new Set<string>();
  for (const edge of input.prerequisites) {
    if (!seen.has(edge.conceptSlug) || !seen.has(edge.prerequisiteSlug)) {
      continue;
    }
    const key = `${edge.conceptSlug}\n${edge.prerequisiteSlug}`;
    if (edges.has(key)) {
      continue;
    }
    edges.add(key);
    const prerequisite = bySlug.get(edge.prerequisiteSlug);
    const dependent = bySlug.get(edge.conceptSlug);
    if (prerequisite === undefined || dependent === undefined) {
      continue;
    }
    prerequisitesOf.get(edge.conceptSlug)?.push(relation(prerequisite));
    dependentsOf.get(edge.prerequisiteSlug)?.push(relation(dependent));
  }

  const concepts: SkillGraphConcept[] = ordered.map((concept) => ({
    slug: concept.slug,
    name: concept.name,
    summary: concept.summary.trim(),
    moduleSlug: concept.moduleSlug,
    moduleTitle: concept.moduleTitle,
    lessonSlug: concept.lessonSlug,
    lessonTitle: concept.lessonTitle,
    lessonAvailability: concept.lessonAvailability,
    state: skillState(concept.band),
    prerequisites: prerequisitesOf.get(concept.slug) ?? [],
    dependents: dependentsOf.get(concept.slug) ?? [],
    evidenceSource: concept.evidenceSource,
    revision: concept.revision ?? null,
  }));

  const modules: SkillGraphModule[] = [];
  const moduleIndex = new Map<string, SkillGraphModule>();
  for (const concept of concepts) {
    let current = moduleIndex.get(concept.moduleSlug);
    if (current === undefined) {
      current = {
        slug: concept.moduleSlug,
        title: concept.moduleTitle,
        conceptSlugs: [],
        counts: { total: 0, unknown: 0, weak: 0, developing: 0, strong: 0 },
      };
      moduleIndex.set(concept.moduleSlug, current);
      modules.push(current);
    }
    current.conceptSlugs.push(concept.slug);
    current.counts.total += 1;
    current.counts[concept.state] += 1;
  }

  const current = input.path?.current ?? null;
  return {
    focus:
      current === null
        ? null
        : {
            moduleTitle: current.moduleTitle,
            lessonTitle: current.title,
            concepts: (input.path?.concepts ?? []).flatMap((concept) =>
              seen.has(concept.slug)
                ? [{ slug: concept.slug, name: concept.name, mark: concept.mark }]
                : [],
            ),
          },
    modules,
    concepts,
  };
}

function relation(concept: SkillGraphConceptInput): SkillGraphRelation {
  return {
    slug: concept.slug,
    name: concept.name,
    state: skillState(concept.band),
  };
}
