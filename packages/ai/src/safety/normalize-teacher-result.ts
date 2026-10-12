import {
  evidenceWeight,
  resolveTeachingTransition,
  selectSkillUpdates,
  type TeachingLessonContext,
} from "@platform/curriculum";
import type {
  AcceptedTeacherTurn,
  ExplanationStyle,
  Locale,
  TeachingState,
  Understanding,
} from "@platform/types";
import { admitExplanationCache } from "../cache/explanation-cache";
import { AIProviderError, type AiSchemaIssue } from "../provider/errors";
import { readTeacherResult, stripModelSecrets } from "../schemas/teacher-result";

const INTERNAL_LEAK =
  /teacher\.system\.v\d|AI_API_KEY|password_hash|postgres(?:ql)?:\/\/|DATABASE_URL\s*[:=]|sk-[A-Za-z0-9]{8,}/i;

const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEMORY_NOTES = 2;
const MAX_MEMORY_CHARS = 280;

export interface TeacherNormalizationScope {
  allowedConceptSlugs: ReadonlySet<string>;
  state: TeachingState;
  mode: "explain" | "socratic";
  hintCount: number;
  incorrectEvaluations: number;
  lesson: TeachingLessonContext;
  allowCache: boolean;
  studentName: string;
  locale: Locale;
  explanationStyle: ExplanationStyle;
  review?: {
    active: boolean;
    focusValid: boolean;
  };
}

export function normalizeTeacherOutput(
  value: unknown,
  scope: TeacherNormalizationScope,
): AcceptedTeacherTurn {
  return normalizeTeacherTurn(value, scope).accepted;
}

export function normalizeTeacherTurn(
  value: unknown,
  scope: TeacherNormalizationScope,
): { accepted: AcceptedTeacherTurn; recoveredIssues: readonly AiSchemaIssue[] } {
  const { result: parsed, recoveredIssues } = readTeacherResult(
    capCollections(stripModelSecrets(value)),
  );
  const allowed = new Set([...scope.allowedConceptSlugs].filter((slug) => !DATABASE_ID.test(slug)));
  const skillUpdates =
    parsed.understanding === "unknown"
      ? []
      : selectSkillUpdates(
          parsed.skillUpdates.filter((item) => !DATABASE_ID.test(item.conceptSlug)),
          allowed,
        );

  const transition =
    scope.mode === "explain" || scope.mode === "socratic"
      ? resolveTeachingTransition({
          state: scope.state,
          mode: scope.mode,
          understanding: parsed.understanding,
          suggestedState: parsed.suggestedState ?? undefined,
          hintCount: scope.hintCount,
          incorrectEvaluations: scope.incorrectEvaluations,
          lesson: scope.lesson,
          review: scope.review,
        })
      : { state: scope.state, forced: true, suggestionAccepted: false };

  const misconception =
    parsed.misconception !== null &&
    allowed.has(parsed.misconception.conceptSlug) &&
    !DATABASE_ID.test(parsed.misconception.conceptSlug)
      ? {
          code: parsed.misconception.code,
          description: stripHtml(parsed.misconception.description).slice(0, MAX_MEMORY_CHARS),
          conceptSlug: parsed.misconception.conceptSlug,
        }
      : null;

  const memoryNotes = parsed.memoryNotes
    .filter((note) => note.conceptSlug === undefined || allowed.has(note.conceptSlug))
    .slice(0, MAX_MEMORY_NOTES)
    .map((note) => ({
      category: note.category,
      conceptSlug: note.conceptSlug ?? null,
      content: stripHtml(note.content).slice(0, MAX_MEMORY_CHARS),
      importance: note.importance,
    }))
    .filter((note) => note.content.length > 0);

  const speech = stripHtml(parsed.speech).trim();
  if (INTERNAL_LEAK.test(speech)) {
    throw new AIProviderError("invalid_response", { failureCategory: "internal_leak_rejection" });
  }
  const homework =
    transition.state === "homework" && parsed.homework !== null
      ? stripHtml(parsed.homework).slice(0, MAX_MEMORY_CHARS)
      : null;

  const cache =
    parsed.cacheableExplanation === null
      ? null
      : admitExplanationCache({
          allowCache: scope.allowCache,
          speech: parsed.cacheableExplanation.speech,
          studentName: scope.studentName,
          conceptSlug: parsed.cacheableExplanation.conceptSlug,
          difficulty: parsed.cacheableExplanation.difficulty,
          locale: scope.locale,
          style: scope.explanationStyle,
          allowedConceptSlugs: allowed,
        });

  return {
    accepted: {
      speech,
      understanding: parsed.understanding,
      misconception,
      skillUpdates,
      memoryNotes,
      state: transition.state,
      suggestionAccepted: transition.suggestionAccepted,
      homework: homework !== null && homework.length > 0 ? homework : null,
      cacheableExplanation: cache !== null && cache.admitted ? cache.entry : null,
    },
    recoveredIssues,
  };
}

export function serverSkillWeight(understanding: Exclude<Understanding, "unknown">): number {
  return evidenceWeight("lesson_check", understanding);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function capCollections(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = { ...(value as Record<string, unknown>) };
  if (Array.isArray(record.skillUpdates)) {
    record.skillUpdates = record.skillUpdates.slice(0, 3);
  }
  if (Array.isArray(record.memoryNotes)) {
    record.memoryNotes = record.memoryNotes.slice(0, 2);
  }
  return record;
}
