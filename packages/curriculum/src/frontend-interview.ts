import type { Difficulty, ExecutionConfig } from "@platform/types";

export interface InterviewQuestionSeed {
  slug: string;
  title: string;
  prompt: string;
  type: "verbal" | "code";
  conceptSlug: string;
  difficulty: Difficulty;
  position: number;
  published: boolean;
  criteria: string;
  weight: number;
  parentSlug?: string;
  starterCode?: string;
  execution?: ExecutionConfig;
}

export interface InterviewSeed {
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  published: boolean;
  requirementSlugs: string[];
  questions: InterviewQuestionSeed[];
}

const EVEN_EXECUTION: ExecutionConfig = {
  entry: "isEven",
  tests: [
    { id: "even-eight", args: [8], expected: true, points: 50 },
    { id: "odd-forty-one", args: [41], expected: false, points: 50 },
  ],
};

export const frontendInterviews: InterviewSeed[] = [
  {
    slug: "frontend-foundation",
    title: "Frontend Developer Interview — Foundation",
    description:
      "HTML, CSS, JavaScript və vebin əsasları üzrə qısa texniki müsahibə. Sualları server seçir.",
    objective: "Əsas anlayışları öz sözünüzlə izah edin.",
    difficulty: "beginner",
    estimatedMinutes: 25,
    published: true,
    requirementSlugs: ["html.elements", "html.text", "html.links", "html.attributes"],
    questions: [
      {
        slug: "warmup",
        title: "İstiləşmə",
        prompt: "Brauzer bir səhifəni serverdən necə istəyir? Qısa izah edin.",
        type: "verbal",
        conceptSlug: "web.http",
        difficulty: "beginner",
        position: 1,
        published: true,
        criteria: "rubric-internal-warmup",
        weight: 1,
      },
      {
        slug: "html",
        title: "HTML element",
        prompt:
          "HTML element nədir? Bir elementin açılış və bağlanış hissəsini öz sözünüzlə deyin.",
        type: "verbal",
        conceptSlug: "html.elements",
        difficulty: "beginner",
        position: 2,
        published: true,
        criteria: "rubric-internal-html",
        weight: 1,
      },
      {
        slug: "semantic",
        title: "Semantik HTML",
        prompt: "Semantik HTML nə üçün lazımdır? header və main nə bildirir?",
        type: "verbal",
        conceptSlug: "html.elements",
        difficulty: "easy",
        position: 3,
        published: true,
        criteria: "rubric-internal-semantic",
        weight: 1,
      },
      {
        slug: "semantic-follow",
        title: "Semantik fərq",
        prompt: "header ilə adi bir div arasındakı fərqi bir cümlə ilə deyin.",
        type: "verbal",
        conceptSlug: "html.elements",
        difficulty: "easy",
        position: 103,
        published: true,
        criteria: "rubric-internal-semantic-follow",
        weight: 0,
        parentSlug: "semantic",
      },
      {
        slug: "css",
        title: "CSS qaydası",
        prompt: "CSS qaydası nədən ibarətdir? Selektor və elan nə deməkdir?",
        type: "verbal",
        conceptSlug: "web.css",
        difficulty: "beginner",
        position: 4,
        published: true,
        criteria: "rubric-internal-css",
        weight: 1,
      },
      {
        slug: "browser",
        title: "Brauzer",
        prompt: "Brauzer HTML sənədini ekranda necə göstərir?",
        type: "verbal",
        conceptSlug: "web.browser",
        difficulty: "beginner",
        position: 5,
        published: true,
        criteria: "rubric-internal-browser",
        weight: 1,
      },
      {
        slug: "url",
        title: "URL",
        prompt: "URL hansı hissələrdən ibarətdir? Ünvan nəyi göstərir?",
        type: "verbal",
        conceptSlug: "web.url",
        difficulty: "beginner",
        position: 6,
        published: true,
        criteria: "rubric-internal-url",
        weight: 1,
      },
      {
        slug: "even",
        title: "Cüt ədəd",
        prompt:
          "isEven adlı bir JavaScript function yazın. O, bir ədəd qəbul edir və ədəd cüt olduqda true qaytarır. Niyə belə yazdığınızı da bir cümlə ilə deyin.",
        type: "code",
        conceptSlug: "web.javascript",
        difficulty: "easy",
        position: 7,
        published: true,
        criteria: "rubric-internal-even",
        weight: 1,
        starterCode: "function isEven(n) {\n  \n}\n",
        execution: EVEN_EXECUTION,
      },
      {
        slug: "debugging",
        title: "Səhvləri tapmaq",
        prompt: "Function gözlənilməz nəticə verəndə ilk nəyi yoxlayırsınız?",
        type: "verbal",
        conceptSlug: "web.javascript",
        difficulty: "easy",
        position: 8,
        published: true,
        criteria: "rubric-internal-debugging",
        weight: 1,
      },
      {
        slug: "links",
        title: "Link",
        prompt: "Bir linkdə href nə işə yarayır?",
        type: "verbal",
        conceptSlug: "html.links",
        difficulty: "beginner",
        position: 9,
        published: true,
        criteria: "rubric-internal-links",
        weight: 1,
      },
      {
        slug: "attributes",
        title: "Atribut",
        prompt: "Elementin atributu ilə onun məzmunu necə fərqlənir?",
        type: "verbal",
        conceptSlug: "html.attributes",
        difficulty: "beginner",
        position: 10,
        published: true,
        criteria: "rubric-internal-attributes",
        weight: 1,
      },
      {
        slug: "unpublished-note",
        title: "Gizli sual",
        prompt: "Bu sual dərc olunmayıb.",
        type: "verbal",
        conceptSlug: "html.elements",
        difficulty: "beginner",
        position: 201,
        published: false,
        criteria: "rubric-internal-hidden-question",
        weight: 1,
      },
    ],
  },
  {
    slug: "frontend-interview-hidden",
    title: "Gizli müsahibə",
    description: "Dərc olunmayıb.",
    objective: "Göstərilmir.",
    difficulty: "beginner",
    estimatedMinutes: 10,
    published: false,
    requirementSlugs: ["html.elements"],
    questions: [
      {
        slug: "draft-only",
        title: "Gizli müsahibə sualı",
        prompt: "Bu müsahibə dərc olunmayıb.",
        type: "verbal",
        conceptSlug: "html.elements",
        difficulty: "beginner",
        position: 1,
        published: true,
        criteria: "rubric-internal-draft-interview",
        weight: 1,
      },
    ],
  },
];
