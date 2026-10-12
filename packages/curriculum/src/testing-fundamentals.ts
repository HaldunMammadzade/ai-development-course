import type {
  CheckQuestionBlock,
  ExerciseDefinition,
  LessonBlock,
  LessonDefinition,
  ReadingBlock,
  RecapBlock,
} from "@platform/types";

export const TESTING_MODULE_SLUG = "testing";

const notARun =
  "Bu məşq test kodunu işlətmir. Server gözlənilən cavabı yoxlayır, Vitest və ya brauzer açmır.";

function reading(position: number, markdown: string, conceptSlugs: string[]): ReadingBlock {
  return { type: "reading", position, markdown, conceptSlugs };
}

function check(
  position: number,
  prompt: string,
  rubric: string[],
  conceptSlugs: string[],
): CheckQuestionBlock {
  return {
    type: "check_question",
    position,
    prompt,
    rubric,
    conceptSlugs,
    difficulty: "beginner",
  };
}

function recap(position: number, points: string[], practicePrompt: string): RecapBlock {
  return { type: "recap", position, points, practicePrompt };
}

function lesson(input: {
  slug: string;
  title: string;
  objective: string;
  position: number;
  concepts: string[];
  blocks: LessonBlock[];
}): LessonDefinition {
  return {
    slug: input.slug,
    title: input.title,
    objective: input.objective,
    status: "published",
    position: input.position,
    estimatedMinutes: 15,
    concepts: input.concepts.map((conceptSlug) => ({ conceptSlug, role: "primary" as const })),
    blocks: input.blocks,
  };
}

function choice(
  input: Omit<ExerciseDefinition, "published" | "language" | "starterCode" | "execution">,
): ExerciseDefinition {
  return { ...input, published: true, language: null, starterCode: "", execution: null };
}

export const testingConcepts = [
  {
    slug: "testing.purpose",
    name: "Testin məqsədi",
    domain: "testing",
    summary: "Test proqramın vəd etdiyi davranışı yoxlayır.",
  },
  {
    slug: "testing.expected-actual",
    name: "Gözlənilən və faktiki nəticə",
    domain: "testing",
    summary: "Gözlənilən nəticə ilə faktiki nəticəni müqayisə etmək.",
  },
  {
    slug: "testing.assertion",
    name: "Assertion",
    domain: "testing",
    summary: "Assertion gözlənilən nəticənin doğru olub-olmadığını yoxlayır.",
  },
  {
    slug: "testing.unit",
    name: "Vahid test",
    domain: "testing",
    summary: "Vahid test bir davranışı qalan sistemdən ayırıb yoxlayır.",
  },
  {
    slug: "testing.edge-case",
    name: "Kənar hal",
    domain: "testing",
    summary: "Kənar hal adi nümunədən fərqli, amma real olan girişdir.",
  },
  {
    slug: "testing.component",
    name: "Komponent testi",
    domain: "testing",
    summary: "Komponent testi görünən nəticəni və komponentin davranışını yoxlayır.",
  },
  {
    slug: "testing.interaction",
    name: "İstifadəçi interaksiyası",
    domain: "testing",
    summary: "İnteraksiya testi klik və yazı kimi hərəkətlərdən sonra nəticəni yoxlayır.",
  },
  {
    slug: "testing.integration",
    name: "İnteqrasiya testi",
    domain: "testing",
    summary: "İnteqrasiya testi bir neçə hissənin birlikdə işləməsini yoxlayır.",
  },
  {
    slug: "testing.e2e",
    name: "Ucdan-uca test",
    domain: "testing",
    summary: "Ucdan-uca test tam istifadəçi axınını yoxlayır.",
  },
  {
    slug: "testing.mock",
    name: "Mock və izolyasiya",
    domain: "testing",
    summary: "Mock yoxlanılan davranışın xaricindəki asılılığı əvəz edir.",
  },
  {
    slug: "testing.failure",
    name: "Uğursuz test",
    domain: "testing",
    summary: "Uğursuz test gözlənilən nəticə ilə faktiki nəticənin fərqini göstərir.",
  },
  {
    slug: "testing.regression",
    name: "Reqresiya",
    domain: "testing",
    summary: "Reqresiya əvvəl işləyən davranışın sonrakı dəyişiklikdə pozulmasıdır.",
  },
  {
    slug: "testing.coverage",
    name: "Test örtüyü",
    domain: "testing",
    summary: "Örtük hansı kodun işlədildiyini göstərir, bütün xətaların yoxluğunu yox.",
  },
  {
    slug: "testing.workflow",
    name: "Test və dəyişiklik axını",
    domain: "testing",
    summary: "Dəyişiklikdən sonra test yazılır, işlədilir, düzəldilir və sonra commit edilir.",
  },
];

export const testingPrerequisites = [
  { conceptSlug: "testing.expected-actual", prerequisiteSlug: "testing.purpose" },
  { conceptSlug: "testing.assertion", prerequisiteSlug: "testing.expected-actual" },
  { conceptSlug: "testing.unit", prerequisiteSlug: "testing.assertion" },
  { conceptSlug: "testing.edge-case", prerequisiteSlug: "testing.unit" },
  { conceptSlug: "testing.component", prerequisiteSlug: "testing.unit" },
  { conceptSlug: "testing.interaction", prerequisiteSlug: "testing.component" },
  { conceptSlug: "testing.integration", prerequisiteSlug: "testing.unit" },
  { conceptSlug: "testing.e2e", prerequisiteSlug: "testing.integration" },
  { conceptSlug: "testing.mock", prerequisiteSlug: "testing.unit" },
  { conceptSlug: "testing.failure", prerequisiteSlug: "testing.assertion" },
  { conceptSlug: "testing.regression", prerequisiteSlug: "testing.failure" },
  { conceptSlug: "testing.coverage", prerequisiteSlug: "testing.regression" },
  { conceptSlug: "testing.workflow", prerequisiteSlug: "testing.coverage" },
];

export const testingLessons: LessonDefinition[] = [
  lesson({
    slug: "testing-why",
    title: "Niyə test yazırıq",
    objective: "Testin vəd edilən davranışı yoxladığını və nəticə fərqini izah etmək.",
    position: 1,
    concepts: ["testing.purpose", "testing.expected-actual"],
    blocks: [
      reading(
        1,
        [
          "Test proqramın nə etməli olduğunu yoxlamaq üçündür. TaskFlow-da status filtri yalnız bitmiş tapşırıqları göstərməlidirsə, test həmin vədi yoxlayır. Testin keçməsi bütün xətaların yoxluğu demək deyil. Yoxlanmayan hal hələ də qala bilər.",
          "Gözlənilən nəticə bizim vədimizdir. Faktiki nəticə kodun verdiyi cavabdır. add(2, 3) üçün gözlənilən nəticə 5-dir. Funksiya 6 qaytarsa, test uğursuz olur, çünki faktiki nəticə gözləniləndən fərqlidir.",
          "Bu dərs test kodunu işlətmir. Sən fərqi oxuyursan, server isə sənin seçimini və yazdığın cavabı mövcud məşq qaydaları ilə yoxlayır.",
        ].join("\n\n"),
        ["testing.purpose", "testing.expected-actual"],
      ),
      check(
        2,
        "Test niyə uğursuz olur?",
        ["Faktiki nəticə gözlənilən nəticədən fərqlidir."],
        ["testing.expected-actual"],
      ),
      recap(
        3,
        [
          "Test vəd edilən davranışı yoxlayır.",
          "Gözlənilən və faktiki nəticə ayrıdır.",
          "Keçən test hər xətanın yoxluğunu sübut etmir.",
        ],
        "TaskFlow filtrində gözlənilən siyahını faktiki siyahıdan ayır.",
      ),
    ],
  }),
  lesson({
    slug: "testing-assertions",
    title: "Gözlənti və assertion",
    objective:
      "Assertion-un girişi, gözlənilən nəticəni və uğursuzluğu necə yoxladığını izah etmək.",
    position: 2,
    concepts: ["testing.assertion"],
    blocks: [
      reading(
        1,
        [
          "Assertion bir cümlədir: bu nəticə bu dəyərə bərabər olmalıdır. Aşağıdakı sətirdə giriş 2 və 3-dür, gözlənilən nəticə 5-dir, assertion isə add(2, 3) çağırışının 5 qaytardığını yoxlayır.",
          "expect(add(2, 3)).toBe(5);",
          "Əgər funksiya 6 qaytarsa, assertion uğursuz olur. Uğursuzluq kodun səhv olduğunu və ya gözləntinin səhv yazıldığını göstərir. Hər test brauzer açmır. Bu assertion təmiz funksiyanı yoxlayır.",
        ].join("\n\n"),
        ["testing.assertion"],
      ),
      check(
        2,
        "expect(add(2, 3)).toBe(5) nəyi yoxlayır?",
        ["add(2, 3) çağırışının 5 qaytarmasını."],
        ["testing.assertion"],
      ),
      recap(
        3,
        [
          "Giriş, gözlənilən nəticə və assertion ayrı hissələrdir.",
          "Uğursuz assertion fərqi göstərir.",
          "Hər test səhifə render etmir.",
        ],
        "2 və 3 üçün düzgün assertion sətrini yaz.",
      ),
    ],
  }),
  lesson({
    slug: "testing-unit",
    title: "Vahid test və kənar hallar",
    objective: "Bir funksiyanı ayrı yoxlamağı və boş siyahı kimi kənar halı seçməyi öyrənmək.",
    position: 3,
    concepts: ["testing.unit", "testing.edge-case"],
    blocks: [
      reading(
        1,
        [
          "Vahid test bir davranışı qalan sistemdən ayırır. TaskFlow-da görünən tapşırıqları seçən funksiya ayrıca yoxlana bilər. Komponent, şəbəkə və bütün səhifə bu testə qarışmır.",
          "Kənar hal adi siyahıdan fərqlidir. Boş tapşırıq siyahısı belə bir haldır: filtr heç nə göstərməməlidir. Mənfi hal da var: uyğun olmayan status seçiləndə həmin tapşırıq görünməməlidir.",
          "Dolu siyahını yoxlayan test boş siyahını yoxlamır. Çatışmayan halı ayrıca yazmaq lazımdır.",
        ].join("\n\n"),
        ["testing.unit", "testing.edge-case"],
      ),
      check(
        2,
        "Boş tapşırıq siyahısı hansı test halıdır?",
        ["Kənar haldır, çünki dolu siyahıdan fərqli real girişdir."],
        ["testing.edge-case"],
      ),
      recap(
        3,
        [
          "Vahid test bir davranışı ayırır.",
          "Boş siyahı kənar haldır.",
          "Çatışmayan hal öz testini istəyir.",
        ],
        "Boş TaskFlow siyahısı üçün gözlənilən nəticəni yaz.",
      ),
    ],
  }),
  lesson({
    slug: "testing-component",
    title: "Komponent və interaksiya",
    objective:
      "Komponentin gördüyünü və istifadəçi hərəkətindən sonra dəyişəni yoxlamağı öyrənmək.",
    position: 4,
    concepts: ["testing.component", "testing.interaction"],
    blocks: [
      reading(
        1,
        [
          "Komponent testi həmin komponentin nə göstərdiyini yoxlayır. TaskFlow siyahısı boşdursa, səhifədə tapşırıq yoxdur. Səhv formada isə xəbərdarlıq görünməlidir. Bu, bütün tətbiqin ucdan-uca axını deyil.",
          "İstifadəçi interaksiyası bir hərəkətdən sonra nəticəni yoxlayır. Tələbə Tamamla düyməsinə basır, test isə tapşırığın tamamlanmış göründüyünü yoxlayır. Klik özü məqsəd deyil. Məqsəd klikdən sonra davranışdır.",
        ].join("\n\n"),
        ["testing.component", "testing.interaction"],
      ),
      check(
        2,
        "Tamamla düyməsinə basan test nəyi yoxlamalıdır?",
        ["Basışdan sonra tapşırığın tamamlanmış vəziyyətini."],
        ["testing.interaction"],
      ),
      recap(
        3,
        ["Komponent testi görünən nəticəni yoxlayır.", "İnteraksiya hərəkətdən sonranı yoxlayır."],
        "TaskFlow tamamlanma davranışını seç.",
      ),
    ],
  }),
  lesson({
    slug: "testing-integration",
    title: "İnteqrasiya və tam axın",
    objective: "Bir neçə hissənin testini tam istifadəçi axınından ayırmaq.",
    position: 5,
    concepts: ["testing.integration", "testing.e2e"],
    blocks: [
      reading(
        1,
        [
          "İnteqrasiya testi bir neçə hissənin birlikdə işləməsini yoxlayır. Form düzgün yazılanda siyahıya yeni tapşırıq düşürsə, forma və siyahı birlikdə yoxlanır. Bu, tək filtr funksiyasının vahid testi deyil.",
          "Ucdan-uca test tam istifadəçi axınıdır: səhifəni aç, tapşırıq əlavə et, filtrlə, tamamla. Hər test belə olmur. Təmiz funksiya və komponent testi brauzerdə bütün tətbiqi gəzmədən də faydalıdır.",
        ].join("\n\n"),
        ["testing.integration", "testing.e2e"],
      ),
      check(
        2,
        "Hər test brauzerdə bütün səhifəni gəzməlidir?",
        ["Xeyr. Vahid və komponent testləri daha kiçik davranışı yoxlayır."],
        ["testing.e2e"],
      ),
      recap(
        3,
        [
          "Vahid test bir davranışı ayırır.",
          "İnteqrasiya bir neçə hissəni birlikdə yoxlayır.",
          "Ucdan-uca test tam axındır.",
        ],
        "Forma və siyahını birlikdə yoxlayan testi seç.",
      ),
    ],
  }),
  lesson({
    slug: "testing-isolation",
    title: "Mock və kövrək test",
    objective: "Nəyi mock etməli olduğunu və kövrək yoxlamanı seçməyi öyrənmək.",
    position: 6,
    concepts: ["testing.mock"],
    blocks: [
      reading(
        1,
        [
          "Mock yoxlanılan davranışın xaricindəki asılılığı əvəz edir. Şəbəkə xətasını yoxlayanda real API çağırışı mock olur ki, test həmin xətanı idarə edə bilsin. Yoxlanılan filtr funksiyasının özünü mock etmək isə testi mənasız edir.",
          "Kövrək test davranış əvəzinə tez dəyişən detala bağlanır. TaskFlow siyahısının dəqiq CSS sinfini yoxlamaq belədir. Görünən tapşırıqların sayını yoxlamaq daha sabitdir. Bu dərs mock-u işlətmir, yalnız nəyin əvəz olunacağını seçdirir.",
        ].join("\n\n"),
        ["testing.mock"],
      ),
      check(
        2,
        "Şəbəkə xətasını yoxlayanda nə mock olunur?",
        ["Real API çağırışı, yoxlanılan davranışın özü yox."],
        ["testing.mock"],
      ),
      recap(
        3,
        ["Mock xarici asılılığı əvəz edir.", "Kövrək test tez dəyişən detala bağlanır."],
        "TaskFlow filtrində nəyin mock olunacağını seç.",
      ),
    ],
  }),
  lesson({
    slug: "testing-failures",
    title: "Uğursuz testi oxumaq",
    objective: "Uğursuz assertion-da gözlənti ilə faktiki nəticəni ayırıb düzəltmək.",
    position: 7,
    concepts: ["testing.failure"],
    blocks: [
      reading(
        1,
        [
          "Uğursuz test diaqnozdur. Məsələn, TaskFlow-da üç görünən tapşırıq var, assertion isə 2 gözləyir. Faktiki nəticə 3-dür. Əvvəlcə hansının səhv olduğuna bax: kod, yoxsa gözlənti.",
          "Bu nümunədə siyahı düzgün üç tapşırıq göstərir. Düzəliş assertion-dadır. Kodu kor-koranə dəyişmək düzgün davranışı poza bilər. Uğursuzluğu oxumadan növbəti dəyişikliyə keçmək səhvi gizlədir.",
        ].join("\n\n"),
        ["testing.failure"],
      ),
      check(
        2,
        "Gözlənti 2, faktiki nəticə 3 və siyahı düzgündürsə, nə dəyişir?",
        ["Assertion, çünki gözlənti faktiki düzgün nəticəyə uyğun deyil."],
        ["testing.failure"],
      ),
      recap(
        3,
        ["Uğursuzluq fərqi göstərir.", "Əvvəlcə kodun, yoxsa gözləntinin səhv olduğunu ayır."],
        "Üç görünən tapşırıq üçün assertion-u düzəlt.",
      ),
    ],
  }),
  lesson({
    slug: "testing-regression",
    title: "Reqresiya və örtük",
    objective: "Köhnə davranışın pozulmasını və örtüyün sərhədini izah etmək.",
    position: 8,
    concepts: ["testing.regression", "testing.coverage"],
    blocks: [
      reading(
        1,
        [
          "Reqresiya əvvəl keçən davranışın yeni dəyişiklikdən sonra pozulmasıdır. TaskFlow filtrini dəyişəndən sonra boş siyahı testi uğursuz olursa, bu reqresiyadır. Köhnə test ona görə qalır ki, yeni iş köhnə vədi sındırmasın.",
          "Örtük testin hansı sətirləri işlətdiyini göstərir. Yüksək örtük faydalı siqnaldır, amma yoxlanmayan gözləntini əvəz etmir. Sətir işləyə bilər, nəticə isə yenə səhv ola bilər. Keçən test və yüksək örtük birlikdə də hər xətanın yoxluğunu sübut etmir.",
        ].join("\n\n"),
        ["testing.regression", "testing.coverage"],
      ),
      check(
        2,
        "Yüksək örtük nə demək deyil?",
        ["Bütün xətaların yoxluğunu sübut etmir."],
        ["testing.coverage"],
      ),
      recap(
        3,
        ["Reqresiya köhnə vədin pozulmasıdır.", "Örtük işlənən kodu göstərir, tam sübut deyil."],
        "Filtr dəyişəndən sonra köhnə testin uğursuzluğunu reqresiya kimi tanı.",
      ),
    ],
  }),
  lesson({
    slug: "testing-taskflow",
    title: "Testi dəyişiklik axınına qoy",
    objective: "TaskFlow dəyişikliyində testi yazıb işlətməyi commit-dən əvvəl yerləşdirmək.",
    position: 9,
    concepts: ["testing.workflow"],
    blocks: [
      reading(
        1,
        [
          "Peşəkar ardıcıllıq belədir: kodu dəyiş, test yaz, testləri işlət, uğursuzluğu oxu, kodu və ya testi düzəlt, yenidən işlət, diff-ə bax, sonra commit et. Bu səhifə həmin ardıcıllığı öyrədir. Commit etmir və CI işlətmir.",
          "TaskFlow nümunəsi status filtridir. Dolu siyahı testi var, boş siyahı testi yoxdursa, çatışmayan hal boş siyahıdır. Bunu real TaskFlow repozitoriyasında işlənmiş test sayma. Bu, ssenaridir.",
        ].join("\n\n"),
        ["testing.workflow"],
      ),
      check(
        2,
        "Test uğursuz olandan sonra növbəti peşəkar addım nədir?",
        ["Uğursuzluğu oxuyub kodu və ya testi düzəltmək, sonra yenidən işlətmək."],
        ["testing.workflow"],
      ),
      recap(
        3,
        [
          "Test commit-dən əvvəl işlədilir.",
          "Bu səhifə commit və CI işlətmir.",
          "Çatışmayan boş siyahı halı ayrıca yazılır.",
        ],
        "Ardıcıllığı yaz və çatışmayan TaskFlow halını adlandır.",
      ),
    ],
  }),
];

export const testingExercises: ExerciseDefinition[] = [
  choice({
    slug: "testing-why-purpose",
    lessonSlug: "testing-why",
    conceptSlug: "testing.purpose",
    title: "Testin vəzifəsi",
    prompt: "Testin əsas vəzifəsi hansıdır?",
    instructions: "Davranışı yoxlayan variantı seç. Sıfır xəta vədini seçmə.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "check-behavior", label: "Vəd edilən davranışı yoxlamaq" },
      { id: "prove-zero", label: "Bütün xətaların yoxluğunu sübut etmək" },
      { id: "replace-reading", label: "Kodu oxumağı əvəz etmək" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "check-behavior",
        points: 100,
        feedback: "Test vədi yoxlayır, bütün xətaların yoxluğunu sübut etmir.",
      },
    ],
  }),
  choice({
    slug: "testing-expected-number",
    lessonSlug: "testing-why",
    conceptSlug: "testing.expected-actual",
    title: "Gözlənilən nəticə",
    prompt: "add(2, 3) 6 qaytarıb. Vəd isə cəmin düzgün olmasıdır. Gözlənilən nəticəni yaz.",
    instructions: "Yalnız gözlənilən rəqəmi yaz. Faktiki 6-nı yazma.",
    difficulty: "beginner",
    type: "code_text",
    position: 2,
    options: [],
    rules: [
      {
        type: "exact_text",
        text: "5",
        points: 100,
        feedback: "Gözlənilən nəticə 5-dir. 6 faktiki səhv nəticədir.",
      },
    ],
  }),
  choice({
    slug: "testing-assertion-line",
    lessonSlug: "testing-assertions",
    conceptSlug: "testing.assertion",
    title: "Düzgün assertion",
    prompt: "add(2, 3) üçün gözlənilən nəticə 5-dir. Assertion sətrini yaz.",
    instructions: "Tam sətir belə olmalıdır: expect(add(2, 3)).toBe(5);",
    difficulty: "beginner",
    type: "code_text",
    position: 1,
    options: [],
    rules: [
      {
        type: "exact_text",
        text: "expect(add(2, 3)).toBe(5);",
        points: 100,
        feedback: "Assertion 2 və 3 girişinin 5 qaytarmasını yoxlayır.",
      },
    ],
  }),
  choice({
    slug: "testing-unit-scope",
    lessonSlug: "testing-unit",
    conceptSlug: "testing.unit",
    title: "Vahid testin sərhədi",
    prompt: "TaskFlow filtr funksiyası üçün vahid test nəyi yoxlayır?",
    instructions: "Bir davranışı ayıran variantı seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "one-function", label: "Filtr funksiyasının öz nəticəsini" },
      { id: "whole-site", label: "Bütün səhifənin brauzerdəki axınını" },
      { id: "github", label: "GitHub-da commit olub-olmadığını" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "one-function",
        points: 100,
        feedback: "Vahid test bir davranışı qalan sistemdən ayırır.",
      },
    ],
  }),
  choice({
    slug: "testing-edge-empty",
    lessonSlug: "testing-unit",
    conceptSlug: "testing.edge-case",
    title: "Boş siyahı",
    prompt:
      'visibleTasks([], "done") üçün gözlənilən nəticəni yaz. Bu, TaskFlow-da boş siyahı halıdır və real test icrası deyil.',
    instructions: "Boş massivi yaz: []",
    difficulty: "beginner",
    type: "code_text",
    position: 2,
    options: [],
    rules: [
      {
        type: "exact_text",
        text: "[]",
        points: 100,
        feedback: "Boş siyahı kənar haldır və gözlənilən nəticə boş massivdir.",
      },
    ],
  }),
  choice({
    slug: "testing-component-output",
    lessonSlug: "testing-component",
    conceptSlug: "testing.component",
    title: "Komponent nəyi yoxlayır",
    prompt: "Boş TaskFlow siyahısının komponent testi nəyi yoxlayır?",
    instructions: "Görünən nəticəni seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "rendered", label: "Siyahıda tapşırıq görünmədiyini" },
      { id: "database", label: "Verilənlər bazasının cədvəl sayını" },
      { id: "coverage-only", label: "Yalnız örtük faizini" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "rendered",
        points: 100,
        feedback: "Komponent testi görünən nəticəni yoxlayır.",
      },
    ],
  }),
  choice({
    slug: "testing-interaction-complete",
    lessonSlug: "testing-component",
    conceptSlug: "testing.interaction",
    title: "Tamamlama interaksiyası",
    prompt: "İstifadəçi TaskFlow-da Tamamla düyməsinə basır. Test nəyi yoxlamalıdır?",
    instructions: "Hərəkətdən sonrakı davranışı seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 2,
    options: [
      { id: "task-done", label: "Tapşırığın tamamlanmış göründüyünü" },
      { id: "button-css", label: "Düymənin dəqiq CSS sinfini" },
      { id: "click-only", label: "Yalnız klik hadisəsinin sayını, nəticəsiz" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "task-done",
        points: 100,
        feedback: "İnteraksiya testi hərəkətdən sonra davranışı yoxlayır.",
      },
    ],
  }),
  choice({
    slug: "testing-integration-parts",
    lessonSlug: "testing-integration",
    conceptSlug: "testing.integration",
    title: "İnteqrasiya sərhədi",
    prompt: "Hansı inteqrasiya testidir?",
    instructions: "Bir neçə hissəni birlikdə yoxlayan variantı seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "form-and-list", label: "Forma göndəriləndə siyahıya tapşırıq düşməsi" },
      { id: "pure-add", label: "add(2, 3) funksiyasının 5 qaytarması" },
      { id: "one-label", label: "Tək düymə mətninin düzgün olması" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "form-and-list",
        points: 100,
        feedback: "İnteqrasiya testi bir neçə hissəni birlikdə yoxlayır.",
      },
    ],
  }),
  choice({
    slug: "testing-e2e-scope",
    lessonSlug: "testing-integration",
    conceptSlug: "testing.e2e",
    title: "Tam axın",
    prompt: "Ucdan-uca test nədir?",
    instructions: "Tam istifadəçi axınını seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 2,
    options: [
      { id: "full-workflow", label: "Səhifədən tamamlanmaya qədər tam istifadəçi axını" },
      { id: "every-browser", label: "Hər testin mütləq brauzer açması" },
      { id: "one-function", label: "Bir təmiz funksiyanın ayrı yoxlanması" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "full-workflow",
        points: 100,
        feedback: "Ucdan-uca test tam axındır. Hər test brauzer açmır.",
      },
    ],
  }),
  choice({
    slug: "testing-mock-target",
    lessonSlug: "testing-isolation",
    conceptSlug: "testing.mock",
    title: "Nəyi mock etməli",
    prompt: "TaskFlow siyahısı API xətasını göstərməlidir. Testdə nə mock olunur?",
    instructions: "Xarici asılılığı seç. Yoxlanılan davranışı əvəz etmə.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "api-error", label: "API çağırışının xəta qaytarması" },
      { id: "filter-itself", label: "Filtr funksiyasının özü" },
      { id: "assertion", label: "Assertion sətri" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "api-error",
        points: 100,
        feedback: "Mock xarici API-ni əvəz edir. Yoxlanılan davranış mock olunmur.",
      },
    ],
  }),
  choice({
    slug: "testing-brittle-check",
    lessonSlug: "testing-isolation",
    conceptSlug: "testing.mock",
    title: "Kövrək yoxlama",
    prompt: "Hansı yoxlama daha kövrəkdir?",
    instructions: "Tez dəyişən detala bağlanan variantı seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 2,
    options: [
      { id: "css-class", label: "Siyahının dəqiq CSS sinfinin bir sətirə bərabər olması" },
      { id: "visible-count", label: "Görünən tapşırıq sayının 3 olması" },
      { id: "empty-list", label: "Boş siyahının boş massiv qaytarması" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "css-class",
        points: 100,
        feedback: "Dəqiq CSS sinfi tez dəyişir. Davranış yoxlaması daha sabitdir.",
      },
    ],
  }),
  choice({
    slug: "testing-failure-fix",
    lessonSlug: "testing-failures",
    conceptSlug: "testing.failure",
    title: "Assertion-u düzəlt",
    prompt:
      "Üç TaskFlow tapşırığı görünür və bu düzgündür. Test isə expect(visible).toHaveLength(2); yazıb. Düzgün assertion-u yaz.",
    instructions: "expect(visible).toHaveLength(3); yaz. Bu, test icrası deyil.",
    difficulty: "beginner",
    type: "code_text",
    position: 1,
    options: [],
    rules: [
      {
        type: "exact_text",
        text: "expect(visible).toHaveLength(3);",
        points: 100,
        feedback: "Faktiki düzgün nəticə 3-dür, ona görə gözlənti 3 olmalıdır.",
      },
    ],
  }),
  choice({
    slug: "testing-regression-spot",
    lessonSlug: "testing-regression",
    conceptSlug: "testing.regression",
    title: "Reqresiyanı tanı",
    prompt: "Status filtrini dəyişəndən sonra əvvəl keçən boş siyahı testi uğursuz oldu. Bu nədir?",
    instructions: "Köhnə davranışın pozulmasını seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 1,
    options: [
      { id: "regression", label: "Reqresiya: köhnə vəd pozulub" },
      { id: "new-feature", label: "Yeni funksiya, ona görə köhnə test silinməlidir" },
      { id: "full-proof", label: "Örtüyün 100 faiz olması" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "regression",
        points: 100,
        feedback: "Əvvəl keçən testin sonrakı dəyişiklikdə uğursuz olması reqresiyadır.",
      },
    ],
  }),
  choice({
    slug: "testing-coverage-limit",
    lessonSlug: "testing-regression",
    conceptSlug: "testing.coverage",
    title: "Örtüyün sərhədi",
    prompt: "Test örtüyü 100 faizdirsə, bu nə deməkdir?",
    instructions: "Örtüyün sübut etmədiyini seç.",
    difficulty: "beginner",
    type: "multiple_choice",
    position: 2,
    options: [
      { id: "not-proof", label: "İşlənən sətirlər çoxdur, amma hər xətanın yoxluğu sübut deyil" },
      { id: "no-bugs", label: "Proqramda heç bir xəta qalmayıb" },
      { id: "skip-tests", label: "Artıq assertion yazmağa ehtiyac yoxdur" },
    ],
    rules: [
      {
        type: "choice_equals",
        optionId: "not-proof",
        points: 100,
        feedback: "Örtük işlənən kodu göstərir. Keçən test belə hər xətanı istisna etmir.",
      },
    ],
  }),
  choice({
    slug: "testing-workflow-order",
    lessonSlug: "testing-taskflow",
    conceptSlug: "testing.workflow",
    title: "Dəyişiklikdən commit-ə",
    prompt: "Kodu dəyişəndən sonra, commit-dən əvvəlki ardıcıllığı yaz.",
    instructions:
      "Bu sözləri bu ardıcıllıqla yaz: Test yaz, Testi işlət, Düzəlt, Yenidən işlət, Commit",
    difficulty: "beginner",
    type: "code_text",
    position: 1,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["Test yaz", "Testi işlət", "Düzəlt", "Yenidən işlət", "Commit"],
        points: 100,
        feedback:
          "Ardıcıllıq belədir: test yaz, işlət, düzəlt, yenidən işlət, sonra commit. Bu səhifə commit etmir.",
      },
    ],
  }),
  choice({
    slug: "testing-missing-empty",
    lessonSlug: "testing-taskflow",
    conceptSlug: "testing.workflow",
    title: "Çatışmayan TaskFlow halı",
    prompt:
      "TaskFlow filtrinin dolu siyahı testi var, boş siyahı testi yoxdur. Çatışmayan halın adını yaz.",
    instructions: "boş siyahı yaz. Bu, real repozitoriyada işlənən test deyil.",
    difficulty: "beginner",
    type: "code_text",
    position: 2,
    options: [],
    rules: [
      {
        type: "exact_text",
        text: "boş siyahı",
        points: 100,
        feedback: "Çatışmayan hal boş siyahıdır. Dolu siyahı testi onu əvəz etmir.",
      },
    ],
  }),
];

export const testingExerciseNotes = { notARun };
