import type { CurriculumDocument, ExerciseDefinition } from "@platform/types";
import { z } from "zod";
import { executionConfigSchema, exerciseRulesSchema } from "./exercise";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "must be a lowercase slug");

const readingBlockSchema = z.object({
  type: z.literal("reading"),
  position: z.number().int().positive(),
  markdown: z.string().trim().min(1),
  conceptSlugs: z.array(slugSchema).min(1),
});

const checkQuestionBlockSchema = z.object({
  type: z.literal("check_question"),
  position: z.number().int().positive(),
  prompt: z.string().trim().min(1),
  rubric: z.array(z.string().trim().min(1)).min(1),
  conceptSlugs: z.array(slugSchema).min(1),
  difficulty: z.enum(["beginner", "easy", "intermediate", "advanced", "expert"]),
  harder: z.boolean().optional(),
});

const recapBlockSchema = z.object({
  type: z.literal("recap"),
  position: z.number().int().positive(),
  points: z.array(z.string().trim().min(1)).min(1),
  practicePrompt: z.string().trim().min(1),
});

const lessonBlockSchema = z.discriminatedUnion("type", [
  readingBlockSchema,
  checkQuestionBlockSchema,
  recapBlockSchema,
]);

const lessonSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  position: z.number().int().positive(),
  estimatedMinutes: z.number().int().min(1).max(180),
  status: z.enum(["draft", "published"]),
  concepts: z
    .array(
      z.object({
        conceptSlug: slugSchema,
        role: z.enum(["primary", "supporting"]),
      }),
    )
    .min(1),
  blocks: z.array(lessonBlockSchema),
});

const moduleSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  position: z.number().int().positive(),
  lessons: z.array(lessonSchema),
});

const pathSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  track: z.enum(["frontend", "backend", "fullstack", "skill"]),
  status: z.enum(["draft", "published"]),
  position: z.number().int().positive(),
  modules: z.array(moduleSchema),
});

const exerciseDefinitionSchema = z.object({
  slug: slugSchema,
  lessonSlug: slugSchema,
  conceptSlug: slugSchema,
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(800),
  instructions: z.string().trim().min(1).max(800),
  type: z.enum(["multiple_choice", "code_text"]),
  language: z.enum(["html", "css", "javascript"]).nullable(),
  difficulty: z.enum(["beginner", "easy", "intermediate", "advanced", "expert"]),
  position: z.number().int().positive(),
  starterCode: z.string().max(2_000).nullable(),
  published: z.boolean(),
  options: z.array(z.object({ id: slugSchema, label: z.string().trim().min(1).max(200) })).max(6),
  rules: exerciseRulesSchema,
  execution: executionConfigSchema.nullable().optional(),
});

export const curriculumDocumentSchema = z.object({
  concepts: z
    .array(
      z.object({
        slug: slugSchema,
        name: z.string().trim().min(1),
        domain: z.string().trim().min(1),
        summary: z.string().trim().min(1),
      }),
    )
    .min(1),
  prerequisites: z.array(
    z.object({
      conceptSlug: slugSchema,
      prerequisiteSlug: slugSchema,
    }),
  ),
  paths: z.array(pathSchema).min(1),
  exercises: z.array(exerciseDefinitionSchema).default([]),
});

export class CurriculumValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("\n"));
    this.name = "CurriculumValidationError";
  }
}

export function validateCurriculum(value: unknown): CurriculumDocument {
  const parsed = curriculumDocumentSchema.safeParse(value);
  if (!parsed.success) {
    throw new CurriculumValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const issues = structuralIssues(parsed.data);
  if (issues.length > 0) {
    throw new CurriculumValidationError(issues);
  }
  return parsed.data;
}

function structuralIssues(document: CurriculumDocument): string[] {
  const issues: string[] = [];
  const conceptSlugs = new Set<string>();

  for (const concept of document.concepts) {
    if (conceptSlugs.has(concept.slug)) {
      issues.push(`duplicate slug: concept ${concept.slug}`);
    }
    conceptSlugs.add(concept.slug);
  }

  const pathSlugs = new Set<string>();
  const pathPositions = new Set<number>();
  const moduleSlugs = new Set<string>();
  const lessonSlugs = new Set<string>();

  for (const path of document.paths) {
    if (pathSlugs.has(path.slug)) {
      issues.push(`duplicate slug: path ${path.slug}`);
    }
    pathSlugs.add(path.slug);
    if (pathPositions.has(path.position)) {
      issues.push(`duplicate position: path ${path.position}`);
    }
    pathPositions.add(path.position);

    const modulePositions = new Set<number>();
    for (const module of path.modules) {
      if (moduleSlugs.has(module.slug)) {
        issues.push(`duplicate slug: module ${module.slug}`);
      }
      moduleSlugs.add(module.slug);
      if (modulePositions.has(module.position)) {
        issues.push(`duplicate position: module ${path.slug}/${module.position}`);
      }
      modulePositions.add(module.position);

      const lessonPositions = new Set<number>();
      for (const lesson of module.lessons) {
        if (lessonSlugs.has(lesson.slug)) {
          issues.push(`duplicate slug: lesson ${lesson.slug}`);
        }
        lessonSlugs.add(lesson.slug);
        if (lessonPositions.has(lesson.position)) {
          issues.push(`duplicate position: lesson ${module.slug}/${lesson.position}`);
        }
        lessonPositions.add(lesson.position);

        const linked = new Set<string>();
        let primaryCount = 0;
        for (const link of lesson.concepts) {
          if (!conceptSlugs.has(link.conceptSlug)) {
            issues.push(`unknown concept reference: ${lesson.slug} -> ${link.conceptSlug}`);
          }
          if (linked.has(link.conceptSlug)) {
            issues.push(`duplicate concept link: ${lesson.slug} ${link.conceptSlug}`);
          }
          linked.add(link.conceptSlug);
          if (link.role === "primary") {
            primaryCount += 1;
          }
        }
        if (primaryCount < 1) {
          issues.push(`lesson has no primary concept: ${lesson.slug}`);
        }
        if (primaryCount > 2) {
          issues.push(`more than two primary concepts: ${lesson.slug}`);
        }

        const blockPositions = new Set<number>();
        const blockTypes = new Set<string>();
        for (const block of lesson.blocks) {
          if (blockPositions.has(block.position)) {
            issues.push(`duplicate position: block ${lesson.slug}/${block.position}`);
          }
          blockPositions.add(block.position);
          blockTypes.add(block.type);
          if (block.type !== "recap") {
            for (const conceptSlug of block.conceptSlugs) {
              if (!linked.has(conceptSlug)) {
                issues.push(`unknown concept reference: ${lesson.slug} block -> ${conceptSlug}`);
              }
            }
          }
        }
        if (lesson.status === "published") {
          for (const required of ["reading", "check_question", "recap"] as const) {
            if (!blockTypes.has(required)) {
              issues.push(`published lesson is missing a ${required} block: ${lesson.slug}`);
            }
          }
        }
      }
    }
  }

  for (const edge of document.prerequisites) {
    if (!conceptSlugs.has(edge.conceptSlug) || !conceptSlugs.has(edge.prerequisiteSlug)) {
      issues.push(
        `unknown concept reference: ${edge.conceptSlug} requires ${edge.prerequisiteSlug}`,
      );
    }
    if (edge.conceptSlug === edge.prerequisiteSlug) {
      issues.push(`prerequisite self-reference: ${edge.conceptSlug}`);
    }
  }

  issues.push(...exerciseIssues(document, lessonConcepts(document)));

  const cycle = findCycle(
    [...conceptSlugs],
    document.prerequisites.map((edge) => [edge.conceptSlug, edge.prerequisiteSlug]),
  );
  if (cycle !== null) {
    issues.push(`prerequisite cycle: ${cycle.join(" -> ")}`);
  }

  return issues;
}

function lessonConcepts(document: CurriculumDocument): Map<string, Set<string>> {
  const linked = new Map<string, Set<string>>();
  for (const path of document.paths) {
    for (const module of path.modules) {
      for (const lesson of module.lessons) {
        linked.set(lesson.slug, new Set(lesson.concepts.map((link) => link.conceptSlug)));
      }
    }
  }
  return linked;
}

function exerciseIssues(document: CurriculumDocument, linked: Map<string, Set<string>>): string[] {
  const issues: string[] = [];
  const slugs = new Set<string>();
  const positions = new Set<string>();
  for (const exercise of document.exercises) {
    if (slugs.has(exercise.slug)) {
      issues.push(`duplicate slug: exercise ${exercise.slug}`);
    }
    slugs.add(exercise.slug);
    const positionKey = `${exercise.lessonSlug}/${exercise.position}`;
    if (positions.has(positionKey)) {
      issues.push(`duplicate position: exercise ${positionKey}`);
    }
    positions.add(positionKey);
    const concepts = linked.get(exercise.lessonSlug);
    if (concepts === undefined) {
      issues.push(`unknown lesson reference: exercise ${exercise.slug} -> ${exercise.lessonSlug}`);
    } else if (!concepts.has(exercise.conceptSlug)) {
      issues.push(
        `exercise concept is not on the lesson: ${exercise.slug} -> ${exercise.conceptSlug}`,
      );
    }
    issues.push(...exerciseRuleIssues(exercise));
  }
  return issues;
}

function exerciseRuleIssues(exercise: ExerciseDefinition): string[] {
  const execution = exercise.execution ?? null;
  const choiceRules = exercise.rules.filter((rule) => rule.type === "choice_equals");
  if (exercise.type === "multiple_choice") {
    if (execution !== null) {
      return [`multiple choice cannot execute: ${exercise.slug}`];
    }
    if (exercise.language !== null) {
      return [`multiple choice has no language: ${exercise.slug}`];
    }
    if (exercise.options.length < 2) {
      return [`multiple choice needs options: ${exercise.slug}`];
    }
    if (choiceRules.length !== 1) {
      return [`multiple choice needs one correct option: ${exercise.slug}`];
    }
    const optionIds = new Set(exercise.options.map((option) => option.id));
    const correct = choiceRules[0];
    if (
      correct === undefined ||
      correct.type !== "choice_equals" ||
      !optionIds.has(correct.optionId)
    ) {
      return [`multiple choice answer is not an option: ${exercise.slug}`];
    }
    if (exercise.rules.some((rule) => rule.type !== "choice_equals")) {
      return [`multiple choice cannot use text rules: ${exercise.slug}`];
    }
    return [];
  }
  if (choiceRules.length > 0) {
    return [`code text cannot use a choice rule: ${exercise.slug}`];
  }
  if (exercise.options.length > 0) {
    return [`code text cannot have options: ${exercise.slug}`];
  }
  if (execution !== null) {
    if (exercise.language !== "javascript") {
      return [`execution requires javascript: ${exercise.slug}`];
    }
    const ids = new Set<string>();
    for (const test of execution.tests) {
      if (ids.has(test.id)) {
        return [`duplicate execution test: ${exercise.slug}`];
      }
      ids.add(test.id);
    }
    if (exercise.rules.length !== 1 || exercise.rules[0]?.type !== "execution_only") {
      return [`execution exercise uses only the execution rule: ${exercise.slug}`];
    }
    return [];
  }
  if (exercise.rules.some((rule) => rule.type === "execution_only")) {
    return [`execution rule requires execution config: ${exercise.slug}`];
  }
  return [];
}

function findCycle(concepts: string[], edges: Array<[string, string]>): string[] | null {
  const graph = new Map<string, string[]>(concepts.map((slug) => [slug, []]));
  for (const [concept, prerequisite] of edges) {
    graph.get(concept)?.push(prerequisite);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(node: string): string[] | null {
    const mark = state.get(node);
    if (mark === "done") {
      return null;
    }
    if (mark === "visiting") {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    state.set(node, "visiting");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle !== null) {
        return cycle;
      }
    }
    stack.pop();
    state.set(node, "done");
    return null;
  }

  for (const slug of concepts) {
    const cycle = visit(slug);
    if (cycle !== null) {
      return cycle;
    }
  }
  return null;
}
