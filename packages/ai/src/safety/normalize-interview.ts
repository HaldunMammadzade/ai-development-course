import type { InterviewUnderstanding } from "@platform/types";
import {
  moduleLeakRejection,
  moduleSchemaRejection,
  moduleSolutionRejection,
} from "../provider/errors";

const UNDERSTANDING = new Set(["unknown", "incorrect", "partial", "correct"]);
const REASONING = new Set(["weak", "developing", "strong"]);
const LEAK =
  /interview\.v1|sk-|BEGIN PRIVATE|even-eight|odd-forty-one|ready for a senior|senior role|senior developer|senior mühəndis|senior vəzifə/i;
const SOLUTION = /return\s+n\s*%\s*2\s*===\s*0/i;

export interface InterviewNormalizationScope {
  forbiddenLiterals: readonly string[];
  studentCode: string;
}

export interface NormalizedInterview {
  speech: string;
  understanding: InterviewUnderstanding;
  evaluation: {
    strengths: string[];
    issues: string[];
    reasoningQuality: "weak" | "developing" | "strong";
  };
  followUpRecommended: boolean;
  feedback: string;
}

export function normalizeInterviewOutput(
  value: unknown,
  scope: InterviewNormalizationScope,
): NormalizedInterview {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw moduleSchemaRejection();
  }
  const record = value as Record<string, unknown>;
  const evaluation = record.evaluation;
  if (typeof evaluation !== "object" || evaluation === null || Array.isArray(evaluation)) {
    throw moduleSchemaRejection([{ path: "evaluation", code: "invalid_type" }]);
  }
  const evaluated = evaluation as Record<string, unknown>;
  const understanding = record.understanding;
  const reasoning = evaluated.reasoningQuality;
  if (typeof understanding !== "string") {
    throw moduleSchemaRejection([{ path: "understanding", code: "invalid_type" }]);
  }
  if (!UNDERSTANDING.has(understanding)) {
    throw moduleSchemaRejection([{ path: "understanding", code: "invalid_value" }]);
  }
  if (typeof reasoning !== "string") {
    throw moduleSchemaRejection([{ path: "evaluation.reasoningQuality", code: "invalid_type" }]);
  }
  if (!REASONING.has(reasoning)) {
    throw moduleSchemaRejection([{ path: "evaluation.reasoningQuality", code: "invalid_value" }]);
  }
  if (typeof record.followUpRecommended !== "boolean") {
    throw moduleSchemaRejection([{ path: "followUpRecommended", code: "invalid_type" }]);
  }
  const speech = requiredText(record.speech, "speech", 800);
  const feedback = requiredText(record.feedback, "feedback", 800);
  const strengths = textList(evaluated.strengths, "evaluation.strengths", 4, 160);
  const issues = textList(evaluated.issues, "evaluation.issues", 4, 160);
  const pieces = [speech, feedback, ...strengths, ...issues];
  for (const piece of pieces) {
    if (LEAK.test(piece)) {
      throw moduleLeakRejection();
    }
    if (SOLUTION.test(piece) && !SOLUTION.test(scope.studentCode)) {
      throw moduleSolutionRejection();
    }
    for (const literal of scope.forbiddenLiterals) {
      if (literal.length > 0 && piece.includes(literal)) {
        throw moduleLeakRejection();
      }
    }
  }
  return {
    speech,
    understanding: understanding as InterviewUnderstanding,
    evaluation: {
      strengths,
      issues,
      reasoningQuality: reasoning as NormalizedInterview["evaluation"]["reasoningQuality"],
    },
    followUpRecommended: record.followUpRecommended,
    feedback,
  };
}

function requiredText(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") {
    throw moduleSchemaRejection([{ path, code: "invalid_type" }]);
  }
  const text = value.trim();
  if (text.length === 0) {
    throw moduleSchemaRejection([{ path, code: "too_small" }]);
  }
  return clip(text, max);
}

function textList(value: unknown, path: string, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) {
    throw moduleSchemaRejection([{ path, code: "invalid_type" }]);
  }
  return value.slice(0, maxItems).map((item) => {
    if (typeof item !== "string") {
      throw moduleSchemaRejection([{ path, code: "invalid_type" }]);
    }
    if (item.trim().length === 0) {
      throw moduleSchemaRejection([{ path, code: "too_small" }]);
    }
    return clip(item.trim(), maxChars);
  });
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
