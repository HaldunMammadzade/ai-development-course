import type { ProjectFiles } from "@platform/types";
import type { ProjectCheck } from "@platform/validation";
import { EXERCISE_PASS_SCORE } from "./exercise-validator";

export const PROJECT_PASS_SCORE = EXERCISE_PASS_SCORE;
export const PROJECT_FAILURE_EVIDENCE = 20;

export interface ProjectScriptRequest {
  entry: string;
  tests: Array<{
    id: string;
    args: Array<string | number | boolean | null | Array<string | number | boolean | null>>;
    expected: string | number | boolean | null | Array<string | number | boolean | null>;
    points: number;
  }>;
}

export type ProjectObservationStatus =
  | "completed"
  | "timeout"
  | "memory_limit"
  | "process_limit"
  | "runtime_error"
  | "syntax_error"
  | "runner_error";

export interface ProjectScriptObservation {
  status: ProjectObservationStatus;
  tests: Array<{ id: string; passed: boolean }>;
}

export interface ProjectEvaluation {
  score: number;
  passed: boolean;
  feedback: string;
  passedChecks: string[];
  failedChecks: string[];
}

const EXECUTION_FEEDBACK: Record<
  Exclude<ProjectObservationStatus, "completed" | "runner_error">,
  string
> = {
  timeout: "Kod 2 saniyəlik icra limitini keçdi.",
  memory_limit: "Kod yaddaş limitini keçdi.",
  process_limit: "Kod proses limitini keçdi.",
  runtime_error: "Kod icra edilərkən xəta baş verdi.",
  syntax_error: "Sintaksis xətası var.",
};

export function javascriptRequest(checks: readonly ProjectCheck[]): ProjectScriptRequest | null {
  const check = checks.find((item) => item.type === "javascript_call");
  if (check === undefined || check.type !== "javascript_call") {
    return null;
  }
  return { entry: check.entry, tests: check.tests };
}

export function projectHiddenLiterals(checks: readonly ProjectCheck[]): string[] {
  const values: string[] = [];
  for (const check of checks) {
    if (check.type !== "javascript_call") {
      continue;
    }
    for (const test of check.tests) {
      values.push(test.id);
      collectLiteral(test.expected, values);
      for (const arg of test.args) {
        collectLiteral(arg, values);
      }
    }
  }
  return [...new Set(values.filter((item) => item.length >= 3 && !/^\d+$/.test(item)))];
}

export function evaluateProjectMilestone(input: {
  checks: readonly ProjectCheck[];
  files: ProjectFiles;
  observation: ProjectScriptObservation | null;
}): ProjectEvaluation {
  const script = input.checks.find((check) => check.type === "javascript_call");
  if (
    script !== undefined &&
    input.observation !== null &&
    input.observation.status !== "completed"
  ) {
    if (input.observation.status === "runner_error") {
      return failed("Kod icra edilərkən xəta baş verdi.");
    }
    return failed(EXECUTION_FEEDBACK[input.observation.status]);
  }

  let total = 0;
  let earned = 0;
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  let passedTests = 0;
  let totalTests = 0;

  for (const check of input.checks) {
    if (check.type === "javascript_call") {
      const observation = input.observation;
      const passedById = new Map(
        observation?.status === "completed"
          ? observation.tests.map((test) => [test.id, test.passed])
          : [],
      );
      let scriptEarned = 0;
      let scriptTotal = 0;
      for (const test of check.tests) {
        scriptTotal += test.points;
        totalTests += 1;
        if (passedById.get(test.id) === true) {
          scriptEarned += test.points;
          passedTests += 1;
        }
      }
      total += scriptTotal;
      earned += scriptEarned;
      if (scriptTotal > 0 && scriptEarned === scriptTotal) {
        passedChecks.push(check.label);
      } else {
        failedChecks.push(check.feedback);
      }
      continue;
    }
    total += check.points;
    if (staticCheckPasses(check, input.files)) {
      earned += check.points;
      passedChecks.push(check.label);
    } else {
      failedChecks.push(check.feedback);
    }
  }

  const score = total === 0 ? 0 : clamp(Math.round((earned / total) * 100), 0, 100);
  const passed = score >= PROJECT_PASS_SCORE;
  const summary =
    totalTests > 0
      ? `${passedTests}/${totalTests} yoxlama keçdi.`
      : passed
        ? "Bu mərhələnin yoxlamaları keçdi."
        : "Bu mərhələnin bəzi hissələri çatışmır.";
  const feedback =
    totalTests > 0 && passedTests !== totalTests
      ? `${summary} Bəzi yoxlamalar uğursuz oldu.`
      : failedChecks.length > 0
        ? (failedChecks[0] ?? summary)
        : summary;
  return { score, passed, feedback, passedChecks, failedChecks };
}

function staticCheckPasses(check: ProjectCheck, files: ProjectFiles): boolean {
  if (check.type === "html_element_exists") {
    return hasTag(files["index.html"], check.tag);
  }
  if (check.type === "html_attribute_equals") {
    return attributeEquals(files["index.html"], check.tag, check.attribute, check.value);
  }
  if (check.type === "contains_text") {
    return files[check.file].includes(check.text);
  }
  if (check.type === "forbidden_text") {
    return !files[check.file].includes(check.text);
  }
  if (check.type === "css_declaration") {
    return cssDeclaration(files["style.css"], check.selector, check.property);
  }
  return false;
}

function failed(feedback: string): ProjectEvaluation {
  return { score: 0, passed: false, feedback, passedChecks: [], failedChecks: [feedback] };
}

function hasTag(html: string, tag: string): boolean {
  return new RegExp(`<${tag}(\\s|>|/)`, "i").test(html);
}

function attributeEquals(html: string, tag: string, attribute: string, value: string): boolean {
  const tags = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const attr = new RegExp(
    `\\b${attribute}\\s*=\\s*(?:"${escapeRegExp(value)}"|'${escapeRegExp(value)}')`,
    "i",
  );
  for (const match of html.matchAll(tags)) {
    if (attr.test(match[0] ?? "")) {
      return true;
    }
  }
  return false;
}

function cssDeclaration(source: string, selector: string, property: string): boolean {
  const lower = source.toLowerCase();
  const needle = selector.toLowerCase();
  const propertyPattern = new RegExp(`(?:^|;)\\s*${escapeRegExp(property.toLowerCase())}\\s*:`);
  let from = 0;
  while (from < lower.length) {
    const at = lower.indexOf(needle, from);
    if (at < 0) {
      return false;
    }
    const open = lower.indexOf("{", at);
    if (open < 0) {
      return false;
    }
    const close = lower.indexOf("}", open);
    const block = lower.slice(open + 1, close === -1 ? lower.length : close);
    if (propertyPattern.test(block)) {
      return true;
    }
    from = at + needle.length;
  }
  return false;
}

function collectLiteral(value: unknown, values: string[]): void {
  if (typeof value === "string") {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLiteral(item, values);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
