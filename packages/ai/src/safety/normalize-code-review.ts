import type { CodeReviewResult } from "@platform/types";
import { moduleLeakRejection, moduleSchemaRejection } from "../provider/errors";
import { parseCodeReviewResult } from "../schemas/code-review-result";

const INTERNAL_LEAK =
  /untrusted student content|code-review\.v\d|project-review\.v1|teacher\.system\.v\d|AI_API_KEY|password_hash|DATABASE_URL|sk-[A-Za-z0-9]{8,}/i;

const DROPPED = new Set([
  "score",
  "passed",
  "mastery",
  "masteryScore",
  "evidence",
  "evidenceWeight",
  "lessonId",
  "exerciseId",
  "userId",
  "attemptId",
  "nextLesson",
  "unlock",
  "quota",
  "plan",
  "billing",
  "hiddenTests",
  "expected",
  "rules",
  "checks",
  "projectComplete",
  "milestoneComplete",
  "learningEvent",
  "systemPrompt",
  "secrets",
  "password",
  "passwordHash",
  "token",
  "apiKey",
]);

export interface CodeReviewNormalizationScope {
  allowedConceptSlugs: ReadonlySet<string>;
  passed: boolean;
  forbiddenLiterals?: readonly string[];
}

export interface CodeReviewSafetyDrop {
  path: "strengths" | "issues";
  category: "internal_leak_rejection" | "hidden_literal";
  count: number;
}

export interface CodeReviewNormalization {
  result: CodeReviewResult;
  safetyDrops: readonly CodeReviewSafetyDrop[];
}

export function normalizeCodeReviewOutput(
  value: unknown,
  scope: CodeReviewNormalizationScope,
): CodeReviewResult {
  return normalizeCodeReviewTurn(value, scope).result;
}

export function normalizeCodeReviewTurn(
  value: unknown,
  scope: CodeReviewNormalizationScope,
): CodeReviewNormalization {
  const stripped = stripDropped(value);
  assertNoLeak(stripped);
  const parsed = parseCodeReviewResult(capReview(stripped));
  const literals = scope.forbiddenLiterals ?? [];
  const summary = clean(parsed.summary);
  const feedback = clean(parsed.feedback);
  rejectUnsafe(summary, literals);
  rejectUnsafe(feedback, literals);
  if (summary.length === 0) {
    throw moduleSchemaRejection([{ path: "summary", code: "too_small" }]);
  }
  if (feedback.length === 0) {
    throw moduleSchemaRejection([{ path: "feedback", code: "too_small" }]);
  }
  const hint = optionalText(parsed.hint, 600);
  const nextQuestion = optionalText(parsed.nextQuestion, 500);
  if (hint !== undefined) {
    rejectUnsafe(hint, literals);
  }
  if (nextQuestion !== undefined) {
    rejectUnsafe(nextQuestion, literals);
  }
  const drops = new SafetyDropCounts();
  const strengths = parsed.strengths.flatMap((item) => {
    const text = clean(item);
    return keepText(text, literals, "strengths", drops) ? [text] : [];
  });
  let understanding = parsed.understanding;
  let issues = parsed.issues.flatMap((issue) => {
    const description = clean(issue.description);
    if (!keepText(description, literals, "issues", drops)) {
      return [];
    }
    return [
      {
        ...(issue.conceptSlug !== undefined && scope.allowedConceptSlugs.has(issue.conceptSlug)
          ? { conceptSlug: issue.conceptSlug }
          : {}),
        type: issue.type,
        description,
      },
    ];
  });
  if (scope.passed) {
    understanding = "correct";
    issues = issues.filter((issue) => issue.type === "style");
  }
  const suggestedConcepts = (parsed.suggestedConcepts ?? [])
    .filter((slug) => scope.allowedConceptSlugs.has(slug))
    .slice(0, 3);
  return {
    safetyDrops: drops.list(),
    result: {
      summary,
      understanding,
      feedback,
      ...(hint === undefined ? {} : { hint }),
      strengths: strengths.slice(0, 3),
      issues: issues.slice(0, 3),
      ...(nextQuestion === undefined ? {} : { nextQuestion }),
      ...(suggestedConcepts.length === 0 ? {} : { suggestedConcepts }),
    },
  };
}

function stripDropped(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => stripDropped(item));
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (DROPPED.has(key)) {
      continue;
    }
    next[key] = stripDropped(item);
  }
  return next;
}

function capReview(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = { ...(value as Record<string, unknown>) };
  record.summary = clip(record.summary, 500);
  record.feedback = clip(record.feedback, 1_500);
  record.hint = blankToUndefined(clip(record.hint, 600));
  record.nextQuestion = blankToUndefined(clip(record.nextQuestion, 500));
  if (Array.isArray(record.strengths)) {
    record.strengths = record.strengths.slice(0, 3).map((item) => clip(item, 240));
  }
  if (Array.isArray(record.issues)) {
    record.issues = record.issues.slice(0, 3).map((issue) => {
      if (typeof issue !== "object" || issue === null) {
        return issue;
      }
      const row = { ...(issue as Record<string, unknown>) };
      row.description = clip(row.description, 400);
      return row;
    });
  }
  if (Array.isArray(record.suggestedConcepts)) {
    record.suggestedConcepts = record.suggestedConcepts.slice(0, 3);
  }
  return record;
}

function clip(value: unknown, max: number): unknown {
  return typeof value === "string" ? value.trim().slice(0, max) : value;
}

function blankToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.length === 0 ? undefined : value;
}

function clean(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function optionalText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const text = clean(value).slice(0, max);
  return text.length === 0 ? undefined : text;
}

function assertNoLeak(value: unknown): void {
  if (typeof value === "string") {
    if (INTERNAL_LEAK.test(value)) {
      throw moduleLeakRejection();
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoLeak(item);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      assertNoLeak(item);
    }
  }
}

type SafetyReason = "leak" | "literal";

class SafetyDropCounts {
  private readonly counts = {
    strengths: { leak: 0, literal: 0 },
    issues: { leak: 0, literal: 0 },
  };

  add(path: "strengths" | "issues", reason: SafetyReason): void {
    this.counts[path][reason] += 1;
  }

  list(): CodeReviewSafetyDrop[] {
    const drops: CodeReviewSafetyDrop[] = [];
    for (const path of ["strengths", "issues"] as const) {
      const leak = this.counts[path].leak;
      const literal = this.counts[path].literal;
      if (leak > 0) {
        drops.push({ path, category: "internal_leak_rejection", count: leak });
      }
      if (literal > 0) {
        drops.push({ path, category: "hidden_literal", count: literal });
      }
    }
    return drops;
  }
}

function keepText(
  value: string,
  literals: readonly string[],
  path: "strengths" | "issues",
  drops: SafetyDropCounts,
): boolean {
  if (value.length === 0) {
    return false;
  }
  const reason = safetyReason(value, literals);
  if (reason === null) {
    return true;
  }
  drops.add(path, reason);
  return false;
}

function safetyReason(value: string, literals: readonly string[]): SafetyReason | null {
  if (INTERNAL_LEAK.test(value)) {
    return "leak";
  }
  if (literals.some((literal) => literal.length > 0 && value.includes(literal))) {
    return "literal";
  }
  return null;
}

function unsafeText(value: string, literals: readonly string[]): boolean {
  return safetyReason(value, literals) !== null;
}

function rejectUnsafe(value: string, literals: readonly string[]): void {
  if (unsafeText(value, literals)) {
    throw moduleLeakRejection();
  }
}
