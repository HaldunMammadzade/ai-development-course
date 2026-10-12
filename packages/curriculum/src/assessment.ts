import type { ExerciseRule, ExerciseType } from "@platform/types";
import { evaluateExercise } from "./exercise-validator";
import { isLessonUnlocked, type PrerequisiteEdge } from "./graph";
import { calculateMastery, clampCheckEvidence, evidenceWeight } from "./mastery";
import { UNLOCK_MASTERY } from "./time";

export const ASSESSMENT_ITEM_LIMIT = 15;

export const ASSESSMENT_CONTEXT = "initial_skill_assessment";

export type AssessmentKind = "mcq" | "short" | "code";

export type AssessmentDomain =
  | "html"
  | "css"
  | "javascript"
  | "typescript"
  | "react"
  | "next";

export interface AssessmentOption {
  id: string;
  label: string;
}

export interface AssessmentItem {
  id: string;
  concepts: readonly string[];
  domain: AssessmentDomain;
  kind: AssessmentKind;
  exerciseType: ExerciseType;
  prompt: string;
  options: readonly AssessmentOption[];
  rules: readonly ExerciseRule[];
  followUpOf: string | null;
}

export interface AssessmentAnswerMark {
  itemId: string;
  passed: boolean;
}

export interface PlacementLesson {
  id: string;
  slug: string;
  title: string;
  moduleSlug: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  status: "draft" | "published";
  primaryConceptSlugs: string[];
  progress: "not_started" | "in_progress" | "completed" | null;
}

export interface PlacementResult {
  start: PlacementLesson | null;
  lessonIdsToComplete: string[];
  label: string;
}

const choice = (optionId: string): ExerciseRule => ({
  type: "choice_equals",
  optionId,
  points: 1,
  feedback: "Seçim uyğun gəlmir.",
});

const text = (value: string): ExerciseRule => ({
  type: "contains_text",
  text: value,
  points: 1,
  feedback: "Gözlənilən ifadə yoxdur.",
});

function item(input: {
  id: string;
  concepts: readonly string[];
  domain: AssessmentDomain;
  kind: AssessmentKind;
  prompt: string;
  options?: readonly AssessmentOption[];
  rules: readonly ExerciseRule[];
  followUpOf?: string;
}): AssessmentItem {
  return {
    id: input.id,
    concepts: input.concepts,
    domain: input.domain,
    kind: input.kind,
    exerciseType: input.kind === "mcq" ? "multiple_choice" : "code_text",
    prompt: input.prompt,
    options: input.options ?? [],
    rules: input.rules,
    followUpOf: input.followUpOf ?? null,
  };
}

const options = (correct: string, rest: readonly string[]): AssessmentOption[] => [
  { id: "option-a", label: correct },
  { id: "option-b", label: rest[0] ?? "" },
  { id: "option-c", label: rest[1] ?? "" },
  { id: "option-d", label: rest[2] ?? "" },
];

export const assessmentItems: readonly AssessmentItem[] = [
  item({
    id: "request",
    concepts: ["web.http", "web.browser"],
    domain: "html",
    kind: "mcq",
    prompt: "Brauzer səhifəni göstərməzdən əvvəl serverə nə göndərir?",
    options: options("HTTP sorğusu", ["Hazır CSS faylı", "SQL cədvəli", "Yalnız lokal font"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "request-again",
    concepts: ["web.http", "web.browser"],
    domain: "html",
    kind: "mcq",
    followUpOf: "request",
    prompt: "Server brauzerə səhifənin məzmununu nə ilə qaytarır?",
    options: options("HTTP cavabı", ["Brauzer genişlənməsi", "Terminal əmri", "CSS dəyişəni"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "url",
    concepts: ["web.url"],
    domain: "html",
    kind: "mcq",
    prompt: "https://lindel.dev/docs ünvanında yol hissəsi hansıdır?",
    options: options("/docs", ["https", "lindel.dev", "ünvanın özü deyil"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "roles",
    concepts: ["web.html", "web.css"],
    domain: "html",
    kind: "mcq",
    prompt: "HTML və CSS səhifədə nəyi ayırır?",
    options: options("Quruluşu və görünüşü", [
      "Serveri və verilənlər bazasını",
      "Şifrəni və sessiyanı",
      "Şəbəkəni və diski",
    ]),
    rules: [choice("option-a")],
  }),
  item({
    id: "structure",
    concepts: ["html.document", "html.elements"],
    domain: "html",
    kind: "short",
    prompt: "Səhifənin əsas məzmunu üçün semantik teqin adını yazın.",
    rules: [text("main")],
  }),
  item({
    id: "links",
    concepts: ["html.links", "html.attributes"],
    domain: "html",
    kind: "mcq",
    prompt: "Keçidin getdiyi ünvan harada yazılır?",
    options: options("a elementinin href atributunda", [
      "p elementinin içindəki mətndə",
      "title teqinin adında",
      "CSS selector-unda",
    ]),
    rules: [choice("option-a")],
  }),
  item({
    id: "text",
    concepts: ["html.text"],
    domain: "html",
    kind: "mcq",
    prompt: "Səhifənin əsas başlığı üçün hansı element uyğundur?",
    options: options("h1", ["div", "span", "br"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "semantic",
    concepts: ["html.semantic"],
    domain: "html",
    kind: "mcq",
    prompt: "Naviqasiya keçidləri üçün hansı element niyyəti bildirir?",
    options: options("nav", ["div", "b", "font"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "a11y",
    concepts: ["html.a11y"],
    domain: "html",
    kind: "mcq",
    prompt: "Formadakı input-un əlçatan adı haradan gəlir?",
    options: options("Əlaqəli label elementindən", [
      "Yalnız placeholder mətnindən",
      "Rəngindən",
      "Ən yaxın div-in class adından",
    ]),
    rules: [choice("option-a")],
  }),
  item({
    id: "selector",
    concepts: ["css.selector", "css.box-model"],
    domain: "css",
    kind: "mcq",
    prompt: "p { margin: 0 } qaydasında p nədir və margin qutunun hansı hissəsidir?",
    options: options("Selektor, qutunun xarici boşluğu", [
      "Atribut, qutunun daxili dolğusu",
      "Teqlə eyni şey, border-in özü",
      "Dəyişən, content-in fonu",
    ]),
    rules: [choice("option-a")],
  }),
  item({
    id: "flex",
    concepts: ["css.display", "css.flexbox"],
    domain: "css",
    kind: "mcq",
    prompt: "Uşaqları bir sıraya düzən flex container üçün display nə olmalıdır?",
    options: options("flex", ["inline", "table", "none"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "responsive",
    concepts: ["css.responsive"],
    domain: "css",
    kind: "mcq",
    prompt: "Dar ekranda düzülüşü dəyişmək üçün hansı mexanizm uyğundur?",
    options: options("@media qaydası", ["Yalnız sabit piksel eni", "title atributu", "SQL şərti"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "function",
    concepts: ["js.function"],
    domain: "javascript",
    kind: "code",
    prompt: "İki ədədin cəmini qaytaran function yazın. Funksiyanın adı add olsun.",
    rules: [text("function"), text("return")],
  }),
  item({
    id: "function-again",
    concepts: ["js.function"],
    domain: "javascript",
    kind: "code",
    followUpOf: "function",
    prompt: "Mətn qəbul edib həmin mətni qaytaran function yazın.",
    rules: [text("function"), text("return")],
  }),
  item({
    id: "types",
    concepts: ["ts.primitive", "ts.interface"],
    domain: "typescript",
    kind: "mcq",
    prompt: "interface User { name: string } yazısında name sahəsinin tipi nədir?",
    options: options("string", ["User", "interface", "any-nin özü"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "react",
    concepts: ["react.component", "react.props"],
    domain: "react",
    kind: "mcq",
    prompt: "React komponenti kənardan gələn dəyəri necə qəbul edir?",
    options: options("props ilə", ["document.write ilə", "CSS değişkeni ilə", "SQL parametri ilə"]),
    rules: [choice("option-a")],
  }),
  item({
    id: "next",
    concepts: ["next.app-router", "next.server-component"],
    domain: "next",
    kind: "mcq",
    prompt: "App Router-də server component harada işləyir?",
    options: options("Serverdə, brauzerə göndərilən paketdə deyil", [
      "Yalnız brauzerin console-unda",
      "CSS faylının içində",
      "Hər klikdə verilənlər bazasının sxemini dəyişərək",
    ]),
    rules: [choice("option-a")],
  }),
];

const spine = assessmentItems.filter((entry) => entry.followUpOf === null);

export function assessmentItemById(id: string): AssessmentItem | null {
  return assessmentItems.find((entry) => entry.id === id) ?? null;
}

export function selectAssessmentItem(
  answered: readonly AssessmentAnswerMark[],
): AssessmentItem | null {
  if (answered.length >= ASSESSMENT_ITEM_LIMIT) {
    return null;
  }
  const asked = new Set(answered.map((entry) => entry.itemId));
  const failed = new Set(answered.filter((entry) => !entry.passed).map((entry) => entry.itemId));
  for (const entry of assessmentItems) {
    if (entry.followUpOf !== null && failed.has(entry.followUpOf) && !asked.has(entry.id)) {
      return entry;
    }
  }
  for (const entry of spine) {
    if (!failed.has(entry.id)) {
      continue;
    }
    const follow = assessmentItems.find((candidate) => candidate.followUpOf === entry.id);
    if (follow === undefined || asked.has(follow.id)) {
      return null;
    }
  }
  let previousPassed = true;
  for (const entry of spine) {
    if (asked.has(entry.id)) {
      previousPassed = answered.some((mark) => mark.itemId === entry.id && mark.passed);
      continue;
    }
    return previousPassed ? entry : null;
  }
  return null;
}

export function scoreAssessmentAnswer(
  item: AssessmentItem,
  submission: string,
): { passed: boolean; evidence: number; weight: number } {
  const evaluation = evaluateExercise({
    type: item.exerciseType,
    rules: [...item.rules],
    submission,
  });
  const understanding = evaluation.passed ? "correct" : "incorrect";
  return {
    passed: evaluation.passed,
    evidence: clampCheckEvidence(understanding, evaluation.passed ? 90 : 20),
    weight: evidenceWeight("lesson_check", understanding),
  };
}

export function acceptedAssessmentAnswer(item: AssessmentItem): string {
  for (const rule of item.rules) {
    if (rule.type === "choice_equals") {
      return rule.optionId;
    }
  }
  const parts = item.rules.flatMap((rule) =>
    rule.type === "contains_text" || rule.type === "exact_text" ? [rule.text] : [],
  );
  if (parts.length > 0) {
    return parts.join(" ");
  }
  throw new Error(`Assessment item ${item.id} has no deterministic answer.`);
}

export function projectAssessmentMastery(input: {
  answers: ReadonlyArray<{ itemId: string; passed: boolean; at: Date }>;
  now: Date;
  timeZone: string;
}): Map<string, { score: number; evidenceCount: number }> {
  const events = new Map<string, Array<{ id: string; occurredAt: Date; evidence: number; weight: number }>>();
  input.answers.forEach((answer, index) => {
    const source = assessmentItemById(answer.itemId);
    if (source === null) {
      return;
    }
    const scored = scoreAssessmentAnswer(source, answer.passed ? acceptedAssessmentAnswer(source) : " ");
    for (const conceptSlug of source.concepts) {
      const rows = events.get(conceptSlug) ?? [];
      rows.push({
        id: `${answer.itemId}:${index}:${conceptSlug}`,
        occurredAt: answer.at,
        evidence: answer.passed ? scored.evidence : clampCheckEvidence("incorrect", 20),
        weight: answer.passed ? evidenceWeight("lesson_check", "correct") : evidenceWeight("lesson_check", "incorrect"),
      });
      events.set(conceptSlug, rows);
    }
  });
  const mastery = new Map<string, { score: number; evidenceCount: number }>();
  for (const [conceptSlug, rows] of events) {
    const projection = calculateMastery({ events: rows, now: input.now, timeZone: input.timeZone });
    if (projection !== null) {
      mastery.set(conceptSlug, { score: projection.score, evidenceCount: projection.evidenceCount });
    }
  }
  return mastery;
}

export function placeAssessment(input: {
  lessons: readonly PlacementLesson[];
  prerequisites: readonly PrerequisiteEdge[];
  mastery: ReadonlyMap<string, { score: number; evidenceCount: number } | null>;
}): PlacementResult {
  const ordered = [...input.lessons]
    .filter((lesson) => lesson.status === "published")
    .sort(compareLessons);
  const lessonShape = ordered.map((lesson) => ({
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    modulePosition: lesson.modulePosition,
    lessonPosition: lesson.lessonPosition,
    status: lesson.status,
    primaryConceptSlugs: lesson.primaryConceptSlugs,
    supportingConceptSlugs: [] as string[],
  }));
  const toComplete: string[] = [];
  let start: PlacementLesson | null = null;
  for (const lesson of ordered) {
    if (lesson.progress === "completed") {
      continue;
    }
    if (lesson.progress === "in_progress") {
      start = lesson;
      break;
    }
    const shape = lessonShape.find((entry) => entry.id === lesson.id);
    const known = lesson.primaryConceptSlugs.every((slug) => knownConcept(input.mastery, slug));
    const unlocked =
      shape !== undefined &&
      isLessonUnlocked({
        lesson: shape,
        lessons: lessonShape,
        prerequisites: [...input.prerequisites],
        masteryByConcept: input.mastery,
      });
    if (known && unlocked) {
      toComplete.push(lesson.id);
      continue;
    }
    start = unlocked ? lesson : (ordered[0] ?? null);
    if (!unlocked) {
      return { start: ordered[0] ?? null, lessonIdsToComplete: [], label: startLabel(ordered[0] ?? null) };
    }
    break;
  }
  if (start === null) {
    start = ordered.find((lesson) => lesson.progress !== "completed") ?? null;
  }
  return { start, lessonIdsToComplete: toComplete, label: startLabel(start) };
}

export function startLabel(lesson: PlacementLesson | null): string {
  if (lesson === null) {
    return "Başlanğıc";
  }
  if (lesson.moduleSlug === "react-fundamentals" || lesson.moduleSlug === "nextjs-fundamentals") {
    return "İrəli səviyyə";
  }
  if (lesson.moduleSlug === "typescript-fundamentals" || lesson.moduleSlug === "javascript") {
    return "Orta səviyyə";
  }
  if (lesson.moduleSlug === "css") {
    return "Əsaslar";
  }
  return "Başlanğıc";
}

function knownConcept(
  mastery: ReadonlyMap<string, { score: number; evidenceCount: number } | null>,
  slug: string,
): boolean {
  const row = mastery.get(slug);
  return row !== undefined && row !== null && row.score >= UNLOCK_MASTERY;
}

function compareLessons(left: PlacementLesson, right: PlacementLesson): number {
  if (left.modulePosition !== right.modulePosition) {
    return left.modulePosition - right.modulePosition;
  }
  return left.lessonPosition - right.lessonPosition;
}
