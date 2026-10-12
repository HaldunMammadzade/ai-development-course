import type { ExerciseRule, ExerciseRuleSummary, ExerciseType } from "@platform/types";

export const EXERCISE_PASS_SCORE = 70;
export const EXERCISE_ATTEMPT_LIMIT = 30;
export const EXERCISE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export interface ExerciseEvaluation {
  score: number;
  passed: boolean;
  feedback: string;
  passedRules: ExerciseRuleSummary[];
  failedRules: ExerciseRuleSummary[];
}

export function evaluateExercise(input: {
  type: ExerciseType;
  rules: ExerciseRule[];
  submission: string;
}): ExerciseEvaluation {
  if (input.submission.trim().length === 0) {
    return {
      score: 0,
      passed: false,
      feedback: "Cavab boşdur.",
      passedRules: [],
      failedRules: [],
    };
  }

  const outcomes = input.rules.map((rule) => ({
    passed: rulePasses(input.type, rule, input.submission),
    feedback: rule.feedback,
    points: rule.points,
  }));
  const total = outcomes.reduce((sum, outcome) => sum + outcome.points, 0);
  const earned = outcomes.reduce((sum, outcome) => sum + (outcome.passed ? outcome.points : 0), 0);
  const score = total === 0 ? 0 : clamp(Math.round((earned / total) * 100), 0, 100);
  const passed = score >= EXERCISE_PASS_SCORE;
  const passedRules = outcomes
    .filter((outcome) => outcome.passed)
    .map((outcome) => ({ feedback: outcome.feedback }));
  const failedRules = outcomes
    .filter((outcome) => !outcome.passed)
    .map((outcome) => ({ feedback: outcome.feedback }));

  return {
    score,
    passed,
    feedback: summary(passed, score, failedRules),
    passedRules,
    failedRules,
  };
}

export function exerciseMasteryUpdate(score: number): { evidence: number; weight: number } | null {
  if (!Number.isInteger(score) || score < EXERCISE_PASS_SCORE) {
    return null;
  }
  if (score >= 80) {
    return { evidence: clamp(score, 80, 100), weight: 1 };
  }
  return { evidence: clamp(score, 45, 75), weight: 1 };
}

function rulePasses(type: ExerciseType, rule: ExerciseRule, submission: string): boolean {
  if (type === "multiple_choice") {
    return rule.type === "choice_equals" && submission.trim() === rule.optionId;
  }
  if (rule.type === "choice_equals") {
    return false;
  }
  if (rule.type === "required_text" || rule.type === "contains_text") {
    return submission.includes(rule.text);
  }
  if (rule.type === "not_contains_text") {
    return !submission.includes(rule.text);
  }
  if (rule.type === "exact_text") {
    return submission.trim() === rule.text;
  }
  if (rule.type === "regex") {
    return new RegExp(rule.pattern, "u").test(submission);
  }
  if (rule.type === "minimum_length") {
    return submission.trim().length >= rule.length;
  }
  if (rule.type === "maximum_length") {
    return submission.trim().length <= rule.length;
  }
  if (rule.type === "html_element_exists") {
    return openingTags(submission, rule.tag).length > 0;
  }
  if (rule.type === "html_attribute_exists") {
    return openingTags(submission, rule.tag).some(
      (tag) => attributeValue(tag, rule.attribute) !== null,
    );
  }
  if (rule.type === "execution_only") {
    return false;
  }
  if (rule.type === "html_attribute_equals") {
    return openingTags(submission, rule.tag).some(
      (tag) => attributeValue(tag, rule.attribute) === rule.value,
    );
  }
  let from = 0;
  for (const token of rule.tokens) {
    const index = submission.indexOf(token, from);
    if (index < 0) {
      return false;
    }
    from = index + token.length;
  }
  return true;
}

function openingTags(source: string, tag: string): string[] {
  const lower = source.toLowerCase();
  const needle = `<${tag.toLowerCase()}`;
  const found: string[] = [];
  let from = 0;
  while (from < lower.length && found.length < 40) {
    const start = lower.indexOf(needle, from);
    if (start < 0) {
      break;
    }
    const next = lower[start + needle.length];
    if (next !== undefined && /[a-z0-9]/.test(next)) {
      from = start + 1;
      continue;
    }
    const end = source.indexOf(">", start);
    if (end < 0) {
      break;
    }
    found.push(source.slice(start, end + 1));
    from = end + 1;
  }
  return found;
}

function attributeValue(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "iu");
  const match = pattern.exec(tag);
  if (match === null) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function summary(passed: boolean, score: number, failed: ExerciseRuleSummary[]): string {
  if (!passed) {
    return failed[0]?.feedback ?? "Bu cavab tapşırığa uyğun gəlmir.";
  }
  return score === 100 ? "Düzgün." : "Əsas hissə düzgündür.";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
