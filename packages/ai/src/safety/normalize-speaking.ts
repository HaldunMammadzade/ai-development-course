import type { SpeakingFeedbackUnderstanding } from "@platform/types";
import {
  moduleLeakRejection,
  moduleSchemaRejection,
  moduleSolutionRejection,
} from "../provider/errors";

const UNDERSTANDING = new Set(["unknown", "incorrect", "partial", "correct"]);
const LEAK =
  /speaking\.v1|interview\.v1|sk-|BEGIN PRIVATE|even-eight|odd-forty-one|ready for a senior|senior role|senior developer|senior mühəndis|senior vəzifə|pronunciation score|accent score/i;
const SOLUTION = /return\s+n\s*%\s*2\s*===\s*0/i;

export interface SpeakingNormalizationScope {
  forbiddenLiterals: readonly string[];
  transcript: string;
}

export interface NormalizedSpeaking {
  speech: string;
  understanding: Exclude<SpeakingFeedbackUnderstanding, "unclear">;
  strengths: string[];
  issues: string[];
  feedback: string;
}

export function normalizeSpeakingOutput(
  value: unknown,
  scope: SpeakingNormalizationScope,
): NormalizedSpeaking {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw moduleSchemaRejection();
  }
  const record = value as Record<string, unknown>;
  const understanding = record.understanding;
  if (typeof understanding !== "string") {
    throw moduleSchemaRejection([{ path: "understanding", code: "invalid_type" }]);
  }
  if (!UNDERSTANDING.has(understanding)) {
    throw moduleSchemaRejection([{ path: "understanding", code: "invalid_value" }]);
  }
  const speech = requiredText(record.speech, "speech", 800);
  const feedback = requiredText(record.feedback, "feedback", 800);
  const strengths = textList(record.strengths);
  const issues = textList(record.issues);
  const pieces = [speech, feedback, ...strengths, ...issues];
  for (const piece of pieces) {
    if (LEAK.test(piece)) {
      throw moduleLeakRejection();
    }
    if (SOLUTION.test(piece) && !SOLUTION.test(scope.transcript)) {
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
    understanding: understanding as NormalizedSpeaking["understanding"],
    strengths,
    issues,
    feedback,
  };
}

function requiredText(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") {
    throw moduleSchemaRejection([{ path, code: "invalid_type" }]);
  }
  const text = strip(value).slice(0, max).trim();
  if (text.length === 0) {
    throw moduleSchemaRejection([{ path, code: "too_small" }]);
  }
  return text;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => strip(item).slice(0, 160).trim())
    .filter((item) => item.length > 0)
    .slice(0, 3);
}

function strip(value: string): string {
  return value.replace(/<[^>]*>/g, "").replaceAll("\0", "");
}
