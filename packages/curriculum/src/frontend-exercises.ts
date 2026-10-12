import type { ExecutionConfig, ExerciseDefinition } from "@platform/types";

const choice = (optionId: string): ExerciseDefinition["rules"] => [
  {
    type: "choice_equals",
    optionId,
    points: 100,
    feedback: "Bu variant bu sualın cavabı deyil. Dərsdəki fərqi bir daha oxu.",
  },
];

export const frontendExercises: ExerciseDefinition[] = [
  {
    slug: "http-request-choice",
    lessonSlug: "how-the-web-delivers-a-page",
    conceptSlug: "web.http",
    title: "HTTP sorğusu",
    prompt: "Brauzer səhifəni göstərməzdən əvvəl serverə nə göndərir?",
    instructions: "Bir variant seç. Düzgünlüyü server yoxlayır.",
    type: "multiple_choice",
    language: null,
    difficulty: "beginner",
    position: 1,
    starterCode: null,
    published: true,
    options: [
      { id: "option-a", label: "HTTP sorğusu" },
      { id: "option-b", label: "Hazır CSS faylı" },
      { id: "option-c", label: "İstifadəçinin parolu" },
      { id: "option-d", label: "JavaScript funksiyasının nəticəsi" },
    ],
    rules: choice("option-a"),
  },
  {
    slug: "http-three-steps",
    lessonSlug: "how-the-web-delivers-a-page",
    conceptSlug: "web.browser",
    title: "Üç addım",
    prompt: "Səhifənin ekrana çıxmasındakı üç addımı ardıcıllıqla yaz.",
    instructions:
      "Sorğu, cavab və göstərmə sözlərini bu ardıcıllıqla yaz. Kod bu mərhələdə icra olunmur.",
    type: "code_text",
    language: null,
    difficulty: "beginner",
    position: 2,
    starterCode: null,
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["sorğu", "cavab", "göstərmə"],
        points: 100,
        feedback: "Üç sözü dərsdəki ardıcıllıqla yaz: sorğu, sonra cavab, sonra göstərmə.",
      },
    ],
  },
  {
    slug: "http-request-hidden",
    lessonSlug: "how-the-web-delivers-a-page",
    conceptSlug: "web.http",
    title: "Gizli tapşırıq",
    prompt: "Bu tapşırıq dərc olunmayıb.",
    instructions: "Göstərilməməlidir.",
    type: "multiple_choice",
    language: null,
    difficulty: "beginner",
    position: 3,
    starterCode: null,
    published: false,
    options: [
      { id: "option-a", label: "Bəli" },
      { id: "option-b", label: "Xeyr" },
    ],
    rules: choice("option-a"),
  },
  {
    slug: "html-heading",
    lessonSlug: "html-text",
    conceptSlug: "html.text",
    title: "Başlıq yaz",
    prompt: "Səhifənin əsas başlığını HTML ilə yaz.",
    instructions:
      "h1 elementi istifadə et. Mətni özün seç. Kod icra olunmur, server yalnız quruluşu yoxlayır.",
    type: "code_text",
    language: "html",
    difficulty: "beginner",
    position: 1,
    starterCode: "<h1></h1>",
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "h1",
        points: 100,
        feedback: "Əsas başlıq h1 elementidir. Açılış teqini yaz.",
      },
    ],
  },
  {
    slug: "html-link",
    lessonSlug: "links-and-attributes",
    conceptSlug: "html.links",
    title: "Keçid yaz",
    prompt: "https://example.com ünvanına aparan, mətni Example olan keçid yaz.",
    instructions:
      "a elementi və href atributu lazımdır. Bu mətn yoxlamasıdır. Kod brauzerdə işlədilmir.",
    type: "code_text",
    language: "html",
    difficulty: "beginner",
    position: 1,
    starterCode: '<a href="">Example</a>',
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "a",
        points: 30,
        feedback: "Keçid a elementidir.",
      },
      {
        type: "html_attribute_equals",
        tag: "a",
        attribute: "href",
        value: "https://example.com",
        points: 40,
        feedback: "href atributu tapşırıqdakı ünvana bərabər olmalıdır.",
      },
      {
        type: "contains_text",
        text: "Example",
        points: 30,
        feedback: "Keçidin görünən mətni Example olmalıdır.",
      },
    ],
  },
  {
    slug: "css-text-color",
    lessonSlug: "html-css-and-javascript",
    conceptSlug: "web.css",
    title: "Mətnə rəng ver",
    prompt: "p elementi üçün rəngi #0f3d34 olan CSS yaz.",
    instructions:
      "color xassəsini yaz. Bu hələ icra olunan CSS deyil. Server yalnız mətni yoxlayır.",
    type: "code_text",
    language: "css",
    difficulty: "beginner",
    position: 1,
    starterCode: "p {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "color\\s*:\\s*#0f3d34",
        points: 100,
        feedback: "p üçün color: #0f3d34 yaz.",
      },
    ],
  },
  {
    slug: "css-card-structure",
    lessonSlug: "html-css-and-javascript",
    conceptSlug: "web.css",
    title: "Sadə kart",
    prompt: "class atributu card olan div və onun içində bir h2 yaz.",
    instructions: "Bu quruluş yoxlamasıdır. Stil brauzerdə işlədilmir.",
    type: "code_text",
    language: "html",
    difficulty: "beginner",
    position: 2,
    starterCode: '<div class="">\n  <h2></h2>\n</div>',
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "div",
        points: 30,
        feedback: "Kartın xarici elementi div olmalıdır.",
      },
      {
        type: "html_attribute_equals",
        tag: "div",
        attribute: "class",
        value: "card",
        points: 40,
        feedback: "div elementinin class atributu card olmalıdır.",
      },
      {
        type: "html_element_exists",
        tag: "h2",
        points: 30,
        feedback: "Kartın içində h2 başlığı olmalıdır.",
      },
    ],
  },
  {
    slug: "javascript-role-choice",
    lessonSlug: "html-css-and-javascript",
    conceptSlug: "web.javascript",
    title: "JavaScript nə üçündür?",
    prompt: "JavaScript səhifədə əsasən nəyi təsvir edir?",
    instructions: "Bir variant seç.",
    type: "multiple_choice",
    language: null,
    difficulty: "beginner",
    position: 3,
    starterCode: null,
    published: true,
    options: [
      { id: "option-a", label: "Səhifənin strukturunu" },
      { id: "option-b", label: "Rəng və ölçünü" },
      { id: "option-c", label: "Davranışı" },
      { id: "option-d", label: "URL ünvanını" },
    ],
    rules: choice("option-c"),
  },
  {
    slug: "javascript-add-function",
    lessonSlug: "html-css-and-javascript",
    conceptSlug: "web.javascript",
    title: "add funksiyası",
    prompt: "İki parametri qəbul edən, adı add olan bir function yaz.",
    instructions:
      "Funksiyanın adı add olmalıdır. Kod işlədilmir. Server yalnız mətnin içində tələb olunan hissələri axtarır.",
    type: "code_text",
    language: "javascript",
    difficulty: "beginner",
    position: 4,
    starterCode: "function name() {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["function", "add"],
        points: 70,
        feedback: "function açar sözündən sonra funksiyanın adı add olmalıdır.",
      },
      {
        type: "not_contains_text",
        text: "eval(",
        points: 30,
        feedback: "eval burada lazım deyil.",
      },
    ],
  },
  executionExercise({
    slug: "js-add",
    title: "İki ədədi topla",
    prompt: "add adlı funksiya iki ədədi qəbul edib onların cəmini qaytarsın.",
    instructions:
      "Funksiyanın adı add olmalıdır. Yoxlama serverdə, ayrı icra mühitində aparılır. Kod brauzerdə işlədilmir.",
    position: 4,
    starterCode: "function add(a, b) {\n  return 0;\n}\n",
    entry: "add",
    tests: [
      { id: "add-a", args: [2, 3], expected: 5, points: 34 },
      { id: "add-b", args: [-2, 5], expected: 3, points: 33 },
      { id: "add-c", args: [0, 0], expected: 0, points: 33 },
    ],
  }),
  executionExercise({
    slug: "js-is-even",
    title: "Cüt ədəd",
    prompt: "isEven adlı funksiya bir ədəd qəbul edib onun cüt olub-olmadığını qaytarsın.",
    instructions: "Cüt ədəd üçün true, tək ədəd üçün false qaytarın. Yoxlama serverdə aparılır.",
    position: 5,
    starterCode: "function isEven(n) {\n  return false;\n}\n",
    entry: "isEven",
    tests: [
      { id: "even-a", args: [2], expected: true, points: 34 },
      { id: "even-b", args: [3], expected: false, points: 33 },
      { id: "even-c", args: [0], expected: true, points: 33 },
    ],
  }),
  executionExercise({
    slug: "js-reverse-string",
    title: "Mətni tərsinə çevir",
    prompt: "reverseString adlı funksiya mətni tərsinə çevirib qaytarsın.",
    instructions: "Yeni sətir yaratmayın. Yoxlama serverdə aparılır. Kod brauzerdə işlədilmir.",
    position: 6,
    starterCode: "function reverseString(value) {\n  return value;\n}\n",
    entry: "reverseString",
    tests: [
      { id: "rev-a", args: ["ab"], expected: "ba", points: 34 },
      { id: "rev-b", args: [""], expected: "", points: 33 },
      { id: "rev-c", args: ["Qx7"], expected: "7xQ", points: 33 },
    ],
  }),
];

function executionExercise(input: {
  slug: string;
  title: string;
  prompt: string;
  instructions: string;
  position: number;
  starterCode: string;
  entry: string;
  tests: ExecutionConfig["tests"];
}): ExerciseDefinition {
  return {
    slug: input.slug,
    lessonSlug: "js-functions",
    conceptSlug: "js.function",
    title: input.title,
    prompt: input.prompt,
    instructions: input.instructions,
    type: "code_text",
    language: "javascript",
    difficulty: "beginner",
    position: input.position,
    starterCode: input.starterCode,
    published: true,
    options: [],
    rules: [
      {
        type: "execution_only",
        points: 100,
        feedback: "Funksiya serverdəki yoxlamalardan keçməlidir.",
      },
    ],
    execution: { entry: input.entry, tests: input.tests },
  };
}
