import type {
  CheckQuestionBlock,
  CurriculumDocument,
  LessonBlock,
  LessonConceptLink,
  LessonDefinition,
  ReadingBlock,
  RecapBlock,
} from "@platform/types";
import { frontendExercises } from "./frontend-exercises";
import { gitConcepts, gitExercises, gitLessons, gitPrerequisites } from "./git-workflow";
import {
  testingConcepts,
  testingExercises,
  testingLessons,
  testingPrerequisites,
} from "./testing-fundamentals";
import {
  nextjsConcepts,
  nextjsExercises,
  nextjsLessons,
  nextjsPrerequisites,
} from "./nextjs-fundamentals";
import {
  reactConcepts,
  reactExercises,
  reactLessons,
  reactPrerequisites,
} from "./react-fundamentals";
import {
  typescriptConcepts,
  typescriptExercises,
  typescriptLessons,
  typescriptPrerequisites,
} from "./typescript-fundamentals";
import {
  a11yLesson,
  basicsLesson,
  cssDraftLessons,
  documentLesson,
  expansionConcepts,
  expansionExercises,
  expansionPrerequisites,
  jsDraftLessons,
  objectLesson,
  arrayLesson,
  functionLesson,
  loopLesson,
  conditionLesson,
  typesLesson,
  variableLesson,
  responsiveLesson,
  flexLesson,
  displayLesson,
  boxLesson,
  selectorLesson,
  semanticLesson,
} from "./frontend-expansion";

function reading(position: number, markdown: string, conceptSlugs: string[]): ReadingBlock {
  return { type: "reading", position, markdown, conceptSlugs };
}

function check(
  position: number,
  prompt: string,
  rubric: string[],
  conceptSlugs: string[],
  difficulty: CheckQuestionBlock["difficulty"],
  harder = false,
): CheckQuestionBlock {
  return {
    type: "check_question",
    position,
    prompt,
    rubric,
    conceptSlugs,
    difficulty,
    ...(harder ? { harder: true } : {}),
  };
}

function recap(position: number, points: string[], practicePrompt: string): RecapBlock {
  return { type: "recap", position, points, practicePrompt };
}

function publishedLesson(input: {
  slug: string;
  title: string;
  objective: string;
  position: number;
  minutes: number;
  concepts: LessonConceptLink[];
  blocks: LessonBlock[];
}): LessonDefinition {
  return {
    slug: input.slug,
    title: input.title,
    objective: input.objective,
    position: input.position,
    estimatedMinutes: input.minutes,
    status: "published",
    concepts: input.concepts,
    blocks: input.blocks,
  };
}

function draftLesson(input: {
  slug: string;
  title: string;
  objective: string;
  conceptSlug: string;
}): LessonDefinition {
  return {
    slug: input.slug,
    title: input.title,
    objective: input.objective,
    position: 1,
    estimatedMinutes: 20,
    status: "draft",
    concepts: [{ conceptSlug: input.conceptSlug, role: "primary" }],
    blocks: [],
  };
}

export const frontendCurriculum: CurriculumDocument = {
  concepts: [
    {
      slug: "web.http",
      name: "HTTP",
      domain: "web",
      summary: "Brauzer serverə sorğu göndərir, server isə cavab qaytarır.",
    },
    {
      slug: "web.browser",
      name: "Browser",
      domain: "web",
      summary: "Brauzer ünvanı qəbul edir, cavabı alır və səhifəni ekranda qurur.",
    },
    {
      slug: "web.url",
      name: "URL",
      domain: "web",
      summary: "URL səhifənin ünvanıdır: sxem, host və path.",
    },
    {
      slug: "web.html",
      name: "HTML",
      domain: "web",
      summary: "HTML səhifənin strukturunu və mətnini təsvir edir.",
    },
    {
      slug: "web.css",
      name: "CSS",
      domain: "web",
      summary: "CSS həmin strukturun görünüşünü təsvir edir.",
    },
    {
      slug: "web.javascript",
      name: "JavaScript",
      domain: "web",
      summary: "JavaScript səhifəyə davranış əlavə edir.",
    },
    {
      slug: "html.elements",
      name: "HTML element",
      domain: "html",
      summary: "Element açılış teqi, məzmun və bağlanış teqindən ibarət ola bilər.",
    },
    {
      slug: "html.text",
      name: "HTML text",
      domain: "html",
      summary: "Başlıq və paraqraf elementləri səhifədəki mətni daşıyır.",
    },
    {
      slug: "html.links",
      name: "Link",
      domain: "html",
      summary: "a elementi başqa bir ünvana keçid yaradır.",
    },
    {
      slug: "html.attributes",
      name: "Attribute",
      domain: "html",
      summary: "Atribut elementə əlavə məlumat verir, məsələn href.",
    },
    {
      slug: "css.selector",
      name: "CSS selector",
      domain: "css",
      summary: "Selektor hansı elementin stilləşəcəyini seçir.",
    },
    {
      slug: "js.value",
      name: "Value",
      domain: "javascript",
      summary: "Dəyər proqramın işlətdiyi konkret məlumatdır.",
    },
    {
      slug: "http.endpoint",
      name: "Endpoint",
      domain: "http",
      summary: "Endpoint bir metod və bir URL cütünə verilən server işidir.",
    },
    ...expansionConcepts,
    ...typescriptConcepts,
    ...reactConcepts,
    ...nextjsConcepts,
    ...gitConcepts,
    ...testingConcepts,
  ],
  prerequisites: [
    { conceptSlug: "web.url", prerequisiteSlug: "web.http" },
    { conceptSlug: "web.html", prerequisiteSlug: "web.browser" },
    { conceptSlug: "web.css", prerequisiteSlug: "web.html" },
    { conceptSlug: "html.elements", prerequisiteSlug: "web.html" },
    { conceptSlug: "html.text", prerequisiteSlug: "html.elements" },
    { conceptSlug: "html.links", prerequisiteSlug: "html.text" },
    { conceptSlug: "html.attributes", prerequisiteSlug: "html.elements" },
    { conceptSlug: "css.selector", prerequisiteSlug: "web.css" },
    { conceptSlug: "web.javascript", prerequisiteSlug: "css.responsive" },
    { conceptSlug: "js.variable", prerequisiteSlug: "web.javascript" },
    { conceptSlug: "js.value", prerequisiteSlug: "js.variable" },
    ...expansionPrerequisites.filter((edge) => edge.conceptSlug !== "js.variable"),
    ...typescriptPrerequisites,
    ...reactPrerequisites,
    ...nextjsPrerequisites,
    ...gitPrerequisites,
    ...testingPrerequisites,
  ],
  paths: [
    {
      slug: "frontend",
      title: "Frontend",
      description: "Brauzerdə görünən veb səhifəni qurmaq üçün yol.",
      track: "frontend",
      status: "published",
      position: 1,
      modules: [
        {
          slug: "web-fundamentals",
          title: "Web Fundamentals",
          description: "Səhifənin brauzerə necə çatdığını və ünvanın hissələrini öyrən.",
          position: 1,
          lessons: [
            publishedLesson({
              slug: "how-the-web-delivers-a-page",
              title: "Brauzer səhifəni necə alır",
              objective: "Brauzerin serverdən HTTP ilə səhifə almasını izah etmək.",
              position: 1,
              minutes: 15,
              concepts: [
                { conceptSlug: "web.http", role: "primary" },
                { conceptSlug: "web.browser", role: "primary" },
              ],
              blocks: [
                reading(
                  1,
                  [
                    "Brauzer (Chrome, Firefox və ya Safari) ünvan sətrinə yazdığın ünvanı götürür.",
                    "O, serverə HTTP sorğusu göndərir. Server sorğunu qəbul edir və HTTP cavabı qaytarır.",
                    "Cavabın içində adətən HTML olur. Brauzer bu HTML-i oxuyur və səhifəni ekranda qurur.",
                    "Üç addımı yadda saxla: sorğu, cavab, göstərmə.",
                  ].join("\n\n"),
                  ["web.http", "web.browser"],
                ),
                check(
                  2,
                  "Brauzer səhifəni göstərməzdən əvvəl nə baş verir?",
                  [
                    "Brauzer serverə HTTP sorğusu göndərir",
                    "Server HTTP cavabı qaytarır",
                    "Cavabda adətən HTML olur",
                  ],
                  ["web.http", "web.browser"],
                  "beginner",
                ),
                recap(
                  3,
                  [
                    "Brauzer serverə sorğu göndərir",
                    "Server HTTP ilə cavab verir",
                    "Brauzer cavabı ekranda göstərir",
                  ],
                  "Öz sözlərinlə izah et: ünvana daxil olanda brauzer və server arasında nə baş verir?",
                ),
              ],
            }),
            publishedLesson({
              slug: "what-a-url-is",
              title: "URL nədir",
              objective: "URL-in sxem, host və path hissələrini ayırd etmək.",
              position: 2,
              minutes: 15,
              concepts: [{ conceptSlug: "web.url", role: "primary" }],
              blocks: [
                reading(
                  1,
                  [
                    "URL səhifənin ünvanıdır. https://example.com/docs ünvanında üç hissə var.",
                    "https sxemdir: əlaqənin qaydasını deyir. example.com hostdur: hansı serverə gedəcəyini deyir.",
                    "/docs pathdir: həmin serverin içində hansı səhifəni istədiyini deyir.",
                    "Brauzer bu hissələri ayırıb HTTP sorğusunu düzgün serverə göndərir.",
                  ].join("\n\n"),
                  ["web.url"],
                ),
                check(
                  2,
                  "https://example.com/docs ünvanında sxem, host və path hansılardır?",
                  ["Sxem https-dir", "Host example.com-dur", "Path /docs-dir"],
                  ["web.url"],
                  "beginner",
                ),
                recap(
                  3,
                  [
                    "URL bir ünvandır",
                    "Sxem əlaqə qaydasıdır",
                    "Host serveri, path isə səhifəni seçir",
                  ],
                  "Bir sayt ünvanı seç və onun sxem, host və path hissələrini yaz.",
                ),
              ],
            }),
            publishedLesson({
              slug: "html-css-and-javascript",
              title: "HTML, CSS və JavaScript",
              objective: "HTML, CSS və JavaScript-in fərqli işlərini ayırd etmək.",
              position: 3,
              minutes: 18,
              concepts: [
                { conceptSlug: "web.html", role: "primary" },
                { conceptSlug: "web.css", role: "primary" },
                { conceptSlug: "web.javascript", role: "supporting" },
              ],
              blocks: [
                reading(
                  1,
                  [
                    "HTML səhifənin strukturudur: başlıq, paraqraf, şəkil və keçid harada durur.",
                    "CSS görünüşdür: rəng, ölçü və yerləşmə. CSS HTML-i əvəz etmir, onu bəzəyir.",
                    "JavaScript davranışdır: düymə basılanda nəsə dəyişir. Bu dərsdə onu yalnız tanıyırıq.",
                    "Əvvəl strukturu (HTML), sonra görünüşü (CSS) öyrənirik.",
                  ].join("\n\n"),
                  ["web.html", "web.css", "web.javascript"],
                ),
                check(
                  2,
                  "Səhifənin mətni və başlıqları hansı dillə yazılır, rəngi isə hansı dillə verilir?",
                  ["Struktur və mətn HTML-dir", "Görünüş CSS-dir", "JavaScript davranış üçündür"],
                  ["web.html", "web.css"],
                  "beginner",
                ),
                recap(
                  3,
                  ["HTML strukturdur", "CSS görünüşdür", "JavaScript davranışdır"],
                  "Bir düymənin mətni, rəngi və basılanda işi üçün hansı dilin cavabdeh olduğunu yaz.",
                ),
              ],
            }),
            documentLesson,
          ],
        },
        {
          slug: "html",
          title: "HTML",
          description: "Element, mətn, keçid və atributla ilk səhifəni yaz.",
          position: 2,
          lessons: [
            publishedLesson({
              slug: "html-elements",
              title: "HTML elementləri",
              objective: "Teq, element və iç-içə quruluşu tanımaq.",
              position: 1,
              minutes: 18,
              concepts: [{ conceptSlug: "html.elements", role: "primary" }],
              blocks: [
                reading(
                  1,
                  [
                    "HTML elementi açılış teqi ilə başlayır. Çoxu bağlanış teqi ilə bitir: <p>Salam</p>.",
                    "Teq elementin adıdır. Element isə teq və onun məzmunudur.",
                    "Elementlər iç-içə girə bilər. Xarici element daxili elementi əhatə edir.",
                    "Səhv bağlanan teq brauzerin səhifəni səhv qurmasına səbəb olur.",
                  ].join("\n\n"),
                  ["html.elements"],
                ),
                check(
                  2,
                  "<p>Salam</p> yazısında teq hansıdır, element hansıdır?",
                  [
                    "Teq p-dir",
                    "Element açılış teqi, mətn və bağlanış teqidir",
                    "Mətn elementin içindədir",
                  ],
                  ["html.elements"],
                  "beginner",
                ),
                recap(
                  3,
                  [
                    "Teq elementin adıdır",
                    "Element teq və məzmundur",
                    "Elementlər iç-içə ola bilər",
                  ],
                  "Bir başlıq elementinin içinə bir paraqraf qoyulmuş kiçik bir nümunə yaz.",
                ),
              ],
            }),
            publishedLesson({
              slug: "html-text",
              title: "HTML mətni",
              objective: "Başlıq və paraqraf elementləri ilə mətn yazmaq.",
              position: 2,
              minutes: 15,
              concepts: [{ conceptSlug: "html.text", role: "primary" }],
              blocks: [
                reading(
                  1,
                  [
                    "h1 səhifənin əsas başlığıdır. h2 və h3 daha kiçik başlıqlardır.",
                    "p elementi adi paraqrafdır. Hər yeni fikir üçün yeni p yazılır.",
                    "Başlıq paraqrafı əvəz etmir. Başlıq bölməni adlandırır, paraqraf isə onu izah edir.",
                  ].join("\n\n"),
                  ["html.text"],
                ),
                check(
                  2,
                  "Səhifənin əsas başlığı və bir izah cümləsi üçün hansı elementləri seçərsən?",
                  [
                    "Əsas başlıq h1-dir",
                    "İzah cümləsi p elementinə yazılır",
                    "h1 və p eyni işi görmür",
                  ],
                  ["html.text"],
                  "beginner",
                ),
                recap(
                  3,
                  ["h1 əsas başlıqdır", "p paraqrafdır", "Başlıq və paraqraf ayrı elementlərdir"],
                  "Öz adın haqqında bir h1 və bir p yaz.",
                ),
              ],
            }),
            publishedLesson({
              slug: "links-and-attributes",
              title: "Keçidlər və atributlar",
              objective: "a teqini və href atributunu düzgün işlətmək.",
              position: 3,
              minutes: 20,
              concepts: [
                { conceptSlug: "html.links", role: "primary" },
                { conceptSlug: "html.attributes", role: "primary" },
              ],
              blocks: [
                reading(
                  1,
                  [
                    "Keçid a elementidir. Görünən mətn elementin içində yazılır: <a>Sənədlər</a>.",
                    "Hara gedəcəyini href atributu deyir. Atribut elementin özü deyil, ona verilən məlumatdır.",
                    'Nümunə: <a href="https://example.com/docs">Sənədlər</a>.',
                    "href-siz a elementi hara getdiyini bilmir.",
                  ].join("\n\n"),
                  ["html.links", "html.attributes"],
                ),
                check(
                  2,
                  "Keçidin görünən mətni və getdiyi ünvan harada yazılır?",
                  [
                    "Görünən mətn a elementinin içindədir",
                    "Ünvan href atributundadır",
                    "a elementsiz href özü keçid deyil",
                  ],
                  ["html.links", "html.attributes"],
                  "beginner",
                ),
                check(
                  3,
                  "href elementdir, yoxsa atribut? Niyə?",
                  [
                    "href atributdur",
                    "O, a elementinə hara gedəcəyini deyir",
                    "Atribut elementin içindəki mətn deyil",
                  ],
                  ["html.attributes"],
                  "easy",
                  true,
                ),
                recap(
                  4,
                  [
                    "Keçid a elementidir",
                    "href atributdur",
                    "Atribut elementə əlavə məlumat verir",
                  ],
                  "example.com/docs ünvanına aparan, mətni Sənədlər olan bir keçid yaz.",
                ),
              ],
            }),
            semanticLesson,
            a11yLesson,
          ],
        },
        {
          slug: "css",
          title: "CSS",
          description: "Selektor, qutu, display, flexbox və dar ekran.",
          position: 3,
          lessons: [
            selectorLesson,
            boxLesson,
            displayLesson,
            flexLesson,
            responsiveLesson,
            ...cssDraftLessons,
          ],
        },
        {
          slug: "javascript",
          title: "JavaScript",
          description: "Dəyişən, tip, şərt, dövr, funksiya, massiv və obyekt.",
          position: 4,
          lessons: [
            basicsLesson,
            variableLesson,
            typesLesson,
            conditionLesson,
            loopLesson,
            functionLesson,
            arrayLesson,
            objectLesson,
            ...jsDraftLessons,
          ],
        },
        {
          slug: "typescript-fundamentals",
          title: "TypeScript Fundamentals",
          description: "JavaScript koduna yazılan zaman tip yoxlaması əlavə et.",
          position: 5,
          lessons: typescriptLessons,
        },
        {
          slug: "react-fundamentals",
          title: "React Fundamentals",
          description: "İnterfeysi komponent, props, state və effektlə qur.",
          position: 6,
          lessons: reactLessons,
        },
        {
          slug: "nextjs-fundamentals",
          title: "Next.js Fundamentals",
          description: "React tətbiqinə marşrut, layout, server sərhədi və metadata əlavə et.",
          position: 7,
          lessons: nextjsLessons,
        },
        {
          slug: "git",
          title: "Git & GitHub",
          description:
            "Dəyişikliyi branch, commit və pull request ilə idarə et. Bu modul Git əmri işlətmir.",
          position: 8,
          lessons: gitLessons,
        },
        {
          slug: "testing",
          title: "Testing Fundamentals",
          description:
            "Gözlənilən nəticəni assertion ilə yoxla. Bu modul tələbənin test kodunu işlətmir.",
          position: 9,
          lessons: testingLessons,
        },
      ],
    },
    {
      slug: "backend",
      title: "Backend",
      description: "Server və API yolu. İlk modulu dərc olunana qədər bağlıdır.",
      track: "backend",
      status: "draft",
      position: 2,
      modules: [
        {
          slug: "http-apis",
          title: "HTTP APIs",
          description: "Endpoint və server cavabı. Bu modul hələ dərc olunmayıb.",
          position: 1,
          lessons: [
            draftLesson({
              slug: "what-an-endpoint-is",
              title: "Endpoint nədir",
              objective: "Endpoint-in bir metod və URL cütü olduğunu izah etmək.",
              conceptSlug: "http.endpoint",
            }),
          ],
        },
      ],
    },
  ],
  exercises: [
    ...frontendExercises,
    ...expansionExercises,
    ...typescriptExercises,
    ...reactExercises,
    ...nextjsExercises,
    ...gitExercises,
    ...testingExercises,
  ],
};
