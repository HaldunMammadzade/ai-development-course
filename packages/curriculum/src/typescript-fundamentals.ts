import type {
  CheckQuestionBlock,
  ConceptDefinition,
  ConceptPrerequisite,
  ExerciseDefinition,
  LessonBlock,
  LessonDefinition,
  ReadingBlock,
  RecapBlock,
} from "@platform/types";

function reading(position: number, markdown: string, conceptSlugs: string[]): ReadingBlock {
  return { type: "reading", position, markdown, conceptSlugs };
}

function check(
  position: number,
  prompt: string,
  rubric: string[],
  conceptSlugs: string[],
  difficulty: CheckQuestionBlock["difficulty"],
): CheckQuestionBlock {
  return { type: "check_question", position, prompt, rubric, conceptSlugs, difficulty };
}

function recap(position: number, points: string[], practicePrompt: string): RecapBlock {
  return { type: "recap", position, points, practicePrompt };
}

function lesson(input: {
  slug: string;
  title: string;
  objective: string;
  position: number;
  minutes: number;
  primary: string;
  supporting?: string[];
  paragraphs: string[];
  question: string;
  rubric: string[];
  points: string[];
  practice: string;
}): LessonDefinition {
  const concepts = [
    { conceptSlug: input.primary, role: "primary" as const },
    ...(input.supporting ?? []).map((conceptSlug) => ({
      conceptSlug,
      role: "supporting" as const,
    })),
  ];
  const blocks: LessonBlock[] = [
    reading(1, input.paragraphs.join("\n\n"), concepts.map((link) => link.conceptSlug)),
    check(2, input.question, input.rubric, [input.primary], "beginner"),
    recap(3, input.points, input.practice),
  ];
  return {
    slug: input.slug,
    title: input.title,
    objective: input.objective,
    position: input.position,
    estimatedMinutes: input.minutes,
    status: "published",
    concepts,
    blocks,
  };
}

function choiceExercise(input: {
  slug: string;
  lessonSlug: string;
  conceptSlug: string;
  title: string;
  prompt: string;
  answer: string;
  options: Array<[string, string]>;
  difficulty: ExerciseDefinition["difficulty"];
  position: number;
}): ExerciseDefinition {
  return {
    slug: input.slug,
    lessonSlug: input.lessonSlug,
    conceptSlug: input.conceptSlug,
    title: input.title,
    prompt: input.prompt,
    instructions: "Bir variant seç. Düzgünlüyü server yoxlayır.",
    type: "multiple_choice",
    language: null,
    difficulty: input.difficulty,
    position: input.position,
    starterCode: null,
    published: true,
    options: input.options.map(([id, label]) => ({ id, label })),
    rules: [
      {
        type: "choice_equals",
        optionId: input.answer,
        points: 100,
        feedback: "Bu variant bu sualın cavabı deyil. Dərsdəki fərqi bir daha oxu.",
      },
    ],
  };
}

function codeExercise(input: {
  slug: string;
  lessonSlug: string;
  conceptSlug: string;
  title: string;
  prompt: string;
  instructions: string;
  difficulty: ExerciseDefinition["difficulty"];
  position: number;
  starterCode: string | null;
  language: "javascript" | null;
  rules: ExerciseDefinition["rules"];
}): ExerciseDefinition {
  return {
    slug: input.slug,
    lessonSlug: input.lessonSlug,
    conceptSlug: input.conceptSlug,
    title: input.title,
    prompt: input.prompt,
    instructions: input.instructions,
    type: "code_text",
    language: input.language,
    difficulty: input.difficulty,
    position: input.position,
    starterCode: input.starterCode,
    published: true,
    options: [],
    rules: input.rules,
  };
}

export const typescriptConcepts: ConceptDefinition[] = [
  {
    slug: "ts.basics",
    name: "TypeScript əsasları",
    domain: "typescript",
    summary: "TypeScript JavaScript-ə yazılan zaman tip yoxlaması əlavə edir.",
  },
  {
    slug: "ts.annotation",
    name: "Tip annotasiyası",
    domain: "typescript",
    summary: "Annotasiya dəyişənin və ya parametrin gözlənilən tipini yazır.",
  },
  {
    slug: "ts.primitive",
    name: "Primitive tiplər",
    domain: "typescript",
    summary: "string, number və boolean ən çox işlənən sadə tiplərdir.",
  },
  {
    slug: "ts.array",
    name: "Tipi olan massiv",
    domain: "typescript",
    summary: "Massivin element tipi elan olunur, məsələn string[].",
  },
  {
    slug: "ts.tuple",
    name: "Tuple",
    domain: "typescript",
    summary: "Tuple sabit sayda və sabit sırada tiplər saxlayır.",
  },
  {
    slug: "ts.object",
    name: "Obyekt tipi",
    domain: "typescript",
    summary: "Obyekt tipində hər sahənin adı və tipi yazılır.",
  },
  {
    slug: "ts.alias",
    name: "Type alias",
    domain: "typescript",
    summary: "type adı bir forma verir ki, həmin forma təkrar yazılmasın.",
  },
  {
    slug: "ts.union",
    name: "Union tip",
    domain: "typescript",
    summary: "Union tip dəyərin sadalanan variantlardan biri ola biləcəyini deyir.",
  },
  {
    slug: "ts.literal",
    name: "Literal tip",
    domain: "typescript",
    summary: "Literal tip dəyəri konkret bir mətn və ya ədədlə məhdudlaşdırır.",
  },
  {
    slug: "ts.interface",
    name: "Interface",
    domain: "typescript",
    summary: "Interface obyektin sahələrini adlı bir müqavilə kimi təsvir edir.",
  },
  {
    slug: "ts.function",
    name: "Funksiya tipi",
    domain: "typescript",
    summary: "Funksiyanın parametrləri və qaytardığı nəticə tipə malik ola bilər.",
  },
  {
    slug: "ts.optional",
    name: "Optional sahə",
    domain: "typescript",
    summary: "Sual işarəsi sahənin obyektdə olmaya da biləcəyini bildirir.",
  },
  {
    slug: "ts.readonly",
    name: "Readonly",
    domain: "typescript",
    summary: "readonly sahə yaradılandan sonra dəyişdirilməməlidir.",
  },
  {
    slug: "ts.narrowing",
    name: "Tip daraltması",
    domain: "typescript",
    summary: "Yoxlamadan sonra TypeScript union-un hansı qolunda olduğunu bilir.",
  },
  {
    slug: "ts.generic",
    name: "Generic əsasları",
    domain: "typescript",
    summary: "Generic funksiya tipi çağırış zamanı saxlayır və eyni tipi qaytarır.",
  },
];

export const typescriptPrerequisites: ConceptPrerequisite[] = [
  { conceptSlug: "ts.basics", prerequisiteSlug: "web.javascript" },
  { conceptSlug: "ts.annotation", prerequisiteSlug: "ts.basics" },
  { conceptSlug: "ts.primitive", prerequisiteSlug: "ts.annotation" },
  { conceptSlug: "ts.array", prerequisiteSlug: "ts.primitive" },
  { conceptSlug: "ts.tuple", prerequisiteSlug: "ts.array" },
  { conceptSlug: "ts.object", prerequisiteSlug: "ts.array" },
  { conceptSlug: "ts.alias", prerequisiteSlug: "ts.object" },
  { conceptSlug: "ts.union", prerequisiteSlug: "ts.object" },
  { conceptSlug: "ts.literal", prerequisiteSlug: "ts.union" },
  { conceptSlug: "ts.interface", prerequisiteSlug: "ts.union" },
  { conceptSlug: "ts.function", prerequisiteSlug: "ts.interface" },
  { conceptSlug: "ts.optional", prerequisiteSlug: "ts.function" },
  { conceptSlug: "ts.readonly", prerequisiteSlug: "ts.optional" },
  { conceptSlug: "ts.narrowing", prerequisiteSlug: "ts.optional" },
  { conceptSlug: "ts.generic", prerequisiteSlug: "ts.narrowing" },
];

export const typescriptLessons: LessonDefinition[] = [
  lesson({
    slug: "what-typescript-is",
    title: "TypeScript nədir və niyə istifadə olunur",
    objective: "TypeScript-in JavaScript-ə statik tip yoxlaması əlavə etdiyini izah etmək.",
    position: 1,
    minutes: 16,
    primary: "ts.basics",
    supporting: ["web.javascript"],
    paragraphs: [
      "JavaScript brauzerdə işləyən dildir. Funksiya arqumentin tipini özü yoxlamır: add(2, 3) ədəd toplayır, add(\"2\", \"3\") isə mətn birləşdirir.",
      "TypeScript eyni JavaScript ekosistemində qalır və yazılan zaman tipi yoxlayır. Bu, proqramı başqa dilə çevirmək deyil. Tip səhvi brauzerə çatmazdan əvvəl görünür.",
      "JavaScript-də function add(a, b) { return a + b } yazılır. TypeScript-də function add(a: number, b: number): number { return a + b } yazılır. İkinci form a və b-nin ədəd olduğunu və nəticənin də ədəd olduğunu deyir.",
      "Kompilyatorun daxili mərhələlərini bu dərsdə öyrənmirik. Məqsəd səhifə kodunda tip səhvini tez görməkdir.",
    ],
    question: "TypeScript JavaScript-i əvəz edir, yoxsa ona tip yoxlaması əlavə edir? Qısa bir add funksiyası ilə göstər.",
    rubric: [
      "TypeScript JavaScript ekosisteminin içindədir",
      "Tip yoxlaması yazılan zaman baş verir",
      "Parametr və nəticə tipi elan oluna bilər",
    ],
    points: [
      "JavaScript brauzerdə işləyir",
      "TypeScript tipi yazılan zaman yoxlayır",
      "İkisi eyni ekosistemdədir",
    ],
    practice: "Tipsiz add funksiyasını number parametrli və number nəticəli formaya çevir.",
  }),
  lesson({
    slug: "type-annotations",
    title: "Type annotations",
    objective: "Dəyişən və parametr üzərində tip annotasiyasını düzgün yerləşdirmək.",
    position: 2,
    minutes: 14,
    primary: "ts.annotation",
    supporting: ["ts.basics"],
    paragraphs: [
      "Annotasiya adın yanında yazılır. const userName: string = \"Haldun\" deyir ki, userName mətn saxlayır.",
      "JavaScript-də const userName = \"Haldun\" dəyərindən tipi təxmin etmək olar. Annotasiya bu təxmini açıq müqaviləyə çevirir. Mətn yerinə ədəd yazılanda yoxlama səhv göstərir.",
      "Parametrdə də eyni qayda işləyir: function greet(name: string). name-in yanında string onun mətn olmasını tələb edir.",
      "Annotasiya dəyəri dəyişmir. O, yalnız hansı dəyərin qəbul olunduğunu yazır.",
    ],
    question: "const age = 31 yazısında tipi açıq göstərmək üçün annotasiya hara əlavə olunur?",
    rubric: [
      "Annotasiya adın yanındadır",
      "age üçün number uyğundur",
      "Annotasiya dəyərin özünü dəyişmir",
    ],
    points: ["Annotasiya addan sonra yazılır", "string mətn üçündür", "number ədəd üçündür"],
    practice: "userName dəyişəninə string annotasiyası yaz.",
  }),
  lesson({
    slug: "primitive-types",
    title: "Primitive types",
    objective: "string, number və boolean tiplərini düzgün dəyərlə bağlamaq.",
    position: 3,
    minutes: 14,
    primary: "ts.primitive",
    supporting: ["ts.annotation"],
    paragraphs: [
      "Üç sadə tip səhifə vəziyyətinin böyük hissəsini örtür. const userName: string = \"Haldun\" mətn saxlayır.",
      "const age: number = 31 ədəd saxlayır. Yaş, qiymət və say number olur. Mətni number dəyişənə qoymaq tip səhvidir.",
      "const isActive: boolean = true yalnız true və ya false qəbul edir. Aktivlik və görünmə kimi suallar boolean olur.",
      "JavaScript-də bu dəyərlər eyni cür yazılır. TypeScript fərqi ondadır ki, səhv tip təyinatı yazılan anda görünür.",
    ],
    question: "İstifadəçinin aktiv olub-olmadığı hansı tipdə saxlanmalıdır və niyə?",
    rubric: [
      "Cavab boolean-dır",
      "true və false iki vəziyyətdir",
      "string və ya number bu sual üçün uyğun deyil",
    ],
    points: ["string mətndir", "number ədəddir", "boolean true və ya false-dir"],
    practice: "userName, age və isActive üçün üç ayrı annotasiya yaz.",
  }),
  lesson({
    slug: "arrays-and-tuples",
    title: "Arrays və tuples",
    objective: "Eyni tipli siyahı ilə sabit sıralı cütlüyü ayırd etmək.",
    position: 4,
    minutes: 16,
    primary: "ts.array",
    supporting: ["ts.primitive", "ts.tuple"],
    paragraphs: [
      "Massiv eyni tipli elementlərin siyahısıdır. const skills: string[] = [\"HTML\", \"CSS\", \"JavaScript\"] hər elementin mətn olduğunu deyir.",
      "Siyahıya number əlavə etmək string[] müqaviləsini pozur. JavaScript massivi bunu icra zamanı dayandırmır. TypeScript yazılan anda göstərir.",
      "Tuple uzunluğu və sırası sabit olanda lazımdır. const score: [string, number] = [\"Haldun\", 31] əvvəl mətn, sonra ədəd tələb edir.",
      "Bacarıq siyahısı massivdir, çünki sayı dəyişə bilər. Ad və yaş cütlüyü tuple-dır, çünki yerləri dəyişməməlidir.",
    ],
    question: "Bacarıqların siyahısı string[] olmalıdır, yoxsa [string, number]? Niyə?",
    rubric: [
      "Bacarıqlar eyni tipli siyahıdır",
      "string[] uyğundur",
      "Tuple sabit sıra üçündür",
    ],
    points: ["string[] eyni tipli siyahıdır", "Tuple sıra saxlayır", "Siyahının uzunluğu dəyişə bilər"],
    practice: "HTML, CSS və JavaScript saxlayan string[] elanı yaz.",
  }),
  lesson({
    slug: "objects-and-type-aliases",
    title: "Objects və type aliases",
    objective: "Obyektin sahələrini type alias ilə bir dəfə adlandırmaq.",
    position: 5,
    minutes: 16,
    primary: "ts.object",
    supporting: ["ts.array", "ts.alias"],
    paragraphs: [
      "Obyekt bir neçə sahəni bir yerdə saxlayır. Hər sahənin öz tipi olur: id ədəd, name mətn, active boolean.",
      "type User = { id: number; name: string; active: boolean } bu formanı User adı ilə saxlayır. Sonra const user: User yazmaq kifayətdir.",
      "JavaScript-də const user = { id: 1, name: \"Haldun\", active: true } işləyir. TypeScript əlavəsi name yerinə ədəd yazılanda səhv göstərməsidir.",
      "Eyni forma səhifəyə verilən məlumatın şəklidir. Formanı bir dəfə adlandırmaq onu hər funksiyada təkrar yazmaqdan qoruyur.",
    ],
    question: "User formasında name sahəsinə ədəd yazmaq niyə səhvdir?",
    rubric: [
      "name string olmalıdır",
      "type alias sahə tiplərini saxlayır",
      "Ədəd id və ya başqa number sahəyə aid ola bilər",
    ],
    points: ["Obyekt sahələrdən ibarətdir", "type forma üçün addır", "Hər sahənin tipi var"],
    practice: "id, name və active sahələri olan User aliasını yaz.",
  }),
  lesson({
    slug: "unions-and-literals",
    title: "Union və literal types",
    objective: "Dəyərin icazəli variantlarını union və literal tiplə məhdudlaşdırmaq.",
    position: 6,
    minutes: 16,
    primary: "ts.union",
    supporting: ["ts.object", "ts.literal"],
    paragraphs: [
      "Bəzən sahə bir neçə tipdən biri olur. let id: string | number həm mətn, həm ədəd qəbul edir, boolean qəbul etmir.",
      "Ekran vəziyyəti daha da dar ola bilər. let status: \"loading\" | \"success\" | \"error\" yalnız bu üç mətndən biridir.",
      "\"loading\" literal tipdir: istənilən string deyil, məhz bu söz. Səhv yazılmış \"loaded\" bu uniyaya girmir.",
      "Bu forma sorğunun vəziyyətini saxlamaq üçündür. Sərbəst mətn əvəzinə icazəli variantlar səhv vəziyyətin koda qarışmasının qarşısını alır.",
    ],
    question: "status dəyişəni niyə sadə string yox, üç literal-dan ibarət union olur?",
    rubric: [
      "Yalnız üç vəziyyət keçərlidir",
      "Literal konkret sözü saxlayır",
      "Sərbəst string səhv sözə icazə verər",
    ],
    points: ["Union bir neçə variantdır", "Literal konkret dəyərdir", "status üç vəziyyətdən biridir"],
    practice: "loading, success və error saxlayan status unionunu yaz.",
  }),
  lesson({
    slug: "typescript-interfaces",
    title: "Interfaces",
    objective: "Obyekt müqaviləsini interface ilə yazmaq.",
    position: 7,
    minutes: 15,
    primary: "ts.interface",
    supporting: ["ts.union"],
    paragraphs: [
      "interface obyektin hansı sahələrə malik olduğunu adlandırır. interface Product { id: number; title: string; price: number } bir məhsulun müqaviləsidir.",
      "const book: Product = { id: 1, title: \"Qeydlər\", price: 12 } müqaviləyə uyğundur. price sahəsini unutmaq və ya ona mətn yazmaq səhvdir.",
      "type alias da forma yaradır. Interface bu dərsdə obyekt müqaviləsi üçün seçilir, çünki sahələr açıq siyahıdır.",
      "Məhsul kartına verilən məlumat bu müqaviləyə uyğun olmalıdır. Çatışmayan sahə səhifədə boş qiymət göstərməzdən əvvəl görünür.",
    ],
    question: "Product interface-ində price niyə number-dir və onu atmaq olarmı?",
    rubric: [
      "Qiymət ədəddir",
      "Interface-də yazılan sahə tələb olunur",
      "Sahəni atmaq müqaviləni pozur",
    ],
    points: ["interface obyekt müqaviləsidir", "Sahələr tələb olunur", "price number-dir"],
    practice: "id, title və price sahələri olan Product interface-i yaz.",
  }),
  lesson({
    slug: "function-types",
    title: "Functions və function types",
    objective: "Funksiyanın parametr və nəticə tiplərini elan etmək.",
    position: 8,
    minutes: 16,
    primary: "ts.function",
    supporting: ["ts.interface", "js.function"],
    paragraphs: [
      "JavaScript-də function add(a, b) { return a + b } arqumentlərin tipini demir. TypeScript-də function add(a: number, b: number): number { return a + b } hər iki tərəfi bağlayır.",
      "Nəticə tipi parametr siyahısından sonra yazılır. : number funksiyanın ədəd qaytardığını deyir. Mətn qaytarmaq bu elanı pozur.",
      "Ayrı bir tip də yazıla bilər: type Add = (a: number, b: number) => number. Bu, funksiyanın formasını dəyişənin tipinə çevirir.",
      "Səhifədə düymə basılanda çağırılan iş də funksiyadır. Onun arqumenti və nəticəsi məlum olanda səhv çağırış yazılan anda görünür.",
    ],
    question: "add funksiyasında : number nəyi təsvir edir: parametri, yoxsa nəticəni?",
    rubric: [
      "Parametr siyahısından sonrakı tip nəticədir",
      "a və b number parametrdir",
      "Nəticə də number olmalıdır",
    ],
    points: ["Parametrlərin tipi var", "Nəticənin tipi ayrıca yazılır", "JavaScript forması tipsiz qalır"],
    practice: "İki number qəbul edib number qaytaran add funksiyasını yaz.",
  }),
  lesson({
    slug: "optional-and-readonly",
    title: "Optional properties və readonly",
    objective: "Sahənin buraxıla biləcəyini və dəyişməz qalmalı olduğunu ayırd etmək.",
    position: 9,
    minutes: 15,
    primary: "ts.optional",
    supporting: ["ts.function", "ts.readonly"],
    paragraphs: [
      "Bəzi sahələr həmişə gəlmir. nickname?: string sual işarəsi ilə nickname-in olmaya biləcəyini deyir. Olmayan sahəni məcburi saymaq səhv xəbərdarlıq yaradır.",
      "readonly id: number id-nin obyekt yaradılandan sonra dəyişməməli olduğunu deyir. id = 2 yazısı bu müqaviləni pozur.",
      "İkisi eyni şey deyil. Optional sahə əskik ola bilər. Readonly sahə var, amma sonradan yazılmır.",
      "İstifadəçi formasında id sabit qalır, ləqəb isə boş ola bilər. interface User { readonly id: number; name: string; nickname?: string }",
    ],
    question: "nickname?: string ilə readonly id: number arasındakı fərq nədir?",
    rubric: [
      "Sual işarəsi sahəni buraxmağa icazə verir",
      "readonly mövcud sahəni qoruyur",
      "İkisi bir-birini əvəz etmir",
    ],
    points: ["? sahəni optional edir", "readonly dəyişməyi bağlayır", "Məcburi sahə həmişə olmalıdır"],
    practice: "readonly id və optional nickname olan User interface-i yaz.",
  }),
  lesson({
    slug: "type-narrowing",
    title: "Type narrowing",
    objective: "Union dəyərini yoxlama ilə bir qola daraltmaq.",
    position: 10,
    minutes: 16,
    primary: "ts.narrowing",
    supporting: ["ts.union", "ts.optional"],
    paragraphs: [
      "function label(value: string | number) dəyəri ya mətndir, ya ədəddir. Qol seçilmədən yalnız hər iki tipdə olan əməliyyat təhlükəsizdir.",
      "if (typeof value === \"string\") blokunun içində TypeScript value-nu string bilir. Orada value.toUpperCase() uyğundur.",
      "Else qolunda qalan tip number olur. Bu daraltmadır: geniş union yoxlamadan sonra bir tipə enir.",
      "Eyni fikir vəziyyət üçün də keçərlidir. status === \"success\" yoxlanandan sonra uğur qolu ayrıca işlənir. Daraltma olmadan səhv qolda mətn metodu çağırıla bilər.",
    ],
    question: "string | number unionunda toUpperCase harada çağırıla bilər?",
    rubric: [
      "Əvvəl typeof yoxlaması lazımdır",
      "string qolunda metod təhlükəsizdir",
      "Yoxlamadan əvvəl union hələ genişdir",
    ],
    points: ["typeof qolu seçir", "Seçilmiş qolda tip dardır", "Qalan qol digər tipdir"],
    practice: "string | number qəbul edən funksiyada string qolunu typeof ilə ayır.",
  }),
  lesson({
    slug: "generics-basics",
    title: "Generics əsasları",
    objective: "Tipi saxlayan sadə generic funksiya yazmaq.",
    position: 11,
    minutes: 16,
    primary: "ts.generic",
    supporting: ["ts.function", "ts.narrowing"],
    paragraphs: [
      "Bəzən funksiya dəyərin tipini dəyişmir, yalnız onu qaytarır. function identity<T>(value: T): T { return value } T-ni çağırışdan götürür.",
      "identity(\"Haldun\") çağırışında T string olur. identity(31) çağırışında T number olur. Nəticənin tipi arqumentin tipindən kənara çıxmır.",
      "T-ni any ilə əvəz etmək bu əlaqəni silir. Generic əsas budur: tip çağırışa görə təyin olunur və nəticədə qorunur.",
      "Bu dərsdə şərtli tiplər və mürəkkəb generic-lər yoxdur. Bir tip parametrli funksiya sonrakı siyahı və forma işləri üçün bazadır.",
    ],
    question: "identity<T>(value: T): T nə üçün nəticənin tipini arqumentlə eyni saxlayır?",
    rubric: [
      "T həm parametrdə, həm nəticədə eynidir",
      "Çağırış T-ni seçir",
      "Funksiya dəyəri dəyişdirmədən qaytarır",
    ],
    points: ["T tip parametridir", "Giriş və çıxış eyni tipdədir", "any bu əlaqəni silir"],
    practice: "value qəbul edib eyni tipi qaytaran identity funksiyasını yaz.",
  }),
];

const miss = "Bu hissə dərsdəki formaya uyğun deyil. Tipi və adı bir daha yoxla.";

export const typescriptExercises: ExerciseDefinition[] = [
  choiceExercise({
    slug: "ts-why-choice",
    lessonSlug: "what-typescript-is",
    conceptSlug: "ts.basics",
    title: "Tip yoxlaması",
    prompt: "TypeScript JavaScript koduna nə əlavə edir?",
    answer: "option-b",
    options: [
      ["option-a", "Yeni bir brauzer"],
      ["option-b", "Yazılan zaman tip yoxlaması"],
      ["option-c", "CSS qaydaları"],
      ["option-d", "Şəbəkə protokolu"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-add-signature",
    lessonSlug: "what-typescript-is",
    conceptSlug: "ts.basics",
    title: "Tipli add",
    prompt: "İki ədəd qəbul edib ədəd qaytaran add funksiyasının TypeScript başlığını yaz.",
    instructions: "Kod icra olunmur. Parametr və nəticə tipləri görünməlidir.",
    difficulty: "easy",
    position: 2,
    starterCode: "function add(a, b) {\n  return a + b;\n}\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["function add", "a: number", "b: number", "): number"],
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-annotation-place",
    lessonSlug: "type-annotations",
    conceptSlug: "ts.annotation",
    title: "Annotasiyanın yeri",
    prompt: "Hansı sətirdə userName üçün annotasiya düz yazılıb?",
    answer: "option-a",
    options: [
      ["option-a", "const userName: string = \"Haldun\""],
      ["option-b", "const string userName = \"Haldun\""],
      ["option-c", "const userName = string \"Haldun\""],
      ["option-d", "string: const userName = \"Haldun\""],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-username-annotation",
    lessonSlug: "type-annotations",
    conceptSlug: "ts.annotation",
    title: "Ad annotasiyası",
    prompt: "userName dəyişənini string kimi elan et və ona mətn ver.",
    instructions: "Kod icra olunmur. Annotasiya adın yanında olmalıdır.",
    difficulty: "easy",
    position: 2,
    starterCode: "const userName = \"Haldun\";\n",
    language: "javascript",
    rules: [
      {
        type: "contains_text",
        text: "const userName: string",
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-age-type",
    lessonSlug: "primitive-types",
    conceptSlug: "ts.primitive",
    title: "Yaşın tipi",
    prompt: "31 yaşını saxlayan age dəyişəni hansı tipdə olmalıdır?",
    answer: "option-b",
    options: [
      ["option-a", "string"],
      ["option-b", "number"],
      ["option-c", "boolean"],
      ["option-d", "string[]"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-three-primitives",
    lessonSlug: "primitive-types",
    conceptSlug: "ts.primitive",
    title: "Üç sadə tip",
    prompt: "userName, age və isActive dəyişənlərini uyğun tiplərlə yaz.",
    instructions: "Kod icra olunmur. Üç annotasiya da görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "const userName = \"Haldun\";\nconst age = 31;\nconst isActive = true;\n",
    language: "javascript",
    rules: [
      { type: "contains_text", text: "userName: string", points: 34, feedback: miss },
      { type: "contains_text", text: "age: number", points: 33, feedback: miss },
      { type: "contains_text", text: "isActive: boolean", points: 33, feedback: miss },
    ],
  }),
  choiceExercise({
    slug: "ts-skills-shape",
    lessonSlug: "arrays-and-tuples",
    conceptSlug: "ts.array",
    title: "Bacarıq siyahısı",
    prompt: "HTML, CSS və JavaScript siyahısı hansı formada yazılır?",
    answer: "option-a",
    options: [
      ["option-a", "const skills: string[] = [\"HTML\", \"CSS\", \"JavaScript\"]"],
      ["option-b", "const skills: string = [\"HTML\"]"],
      ["option-c", "const skills: number[] = [\"HTML\"]"],
      ["option-d", "const skills: boolean = true"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-skills-array",
    lessonSlug: "arrays-and-tuples",
    conceptSlug: "ts.array",
    title: "string massivi",
    prompt: "skills dəyişənini string massivi kimi elan et.",
    instructions: "Kod icra olunmur. Massivin tipi və ən azı bir mətn element görünməlidir.",
    difficulty: "easy",
    position: 2,
    starterCode: "const skills = [];\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["const skills: string[]", "HTML"],
        points: 100,
        feedback: miss,
      },
    ],
  }),
  codeExercise({
    slug: "ts-name-age-tuple",
    lessonSlug: "arrays-and-tuples",
    conceptSlug: "ts.tuple",
    title: "Ad və yaş cütlüyü",
    prompt: "Əvvəl mətn, sonra ədəd saxlayan score cütlüyünü yaz.",
    instructions: "Kod icra olunmur. Sıra string, sonra number olmalıdır.",
    difficulty: "advanced",
    position: 3,
    starterCode: "const score = [\"Haldun\", 31];\n",
    language: "javascript",
    rules: [
      {
        type: "contains_text",
        text: "[string, number]",
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-alias-role",
    lessonSlug: "objects-and-type-aliases",
    conceptSlug: "ts.alias",
    title: "Formanın adı",
    prompt: "Obyekt formasını bir ad altında saxlamaq üçün hansı yazılış uyğundur?",
    answer: "option-c",
    options: [
      ["option-a", "array User"],
      ["option-b", "function User"],
      ["option-c", "type User = { id: number; name: string }"],
      ["option-d", "const User: number = 1"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-user-alias",
    lessonSlug: "objects-and-type-aliases",
    conceptSlug: "ts.object",
    title: "User forması",
    prompt: "id, name və active sahələri olan User type aliasını yaz.",
    instructions: "Kod icra olunmur. Üç sahənin tipi də görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "type User = {\n};\n",
    language: "javascript",
    rules: [
      { type: "contains_text", text: "type User", points: 25, feedback: miss },
      { type: "contains_text", text: "id: number", points: 25, feedback: miss },
      { type: "contains_text", text: "name: string", points: 25, feedback: miss },
      { type: "contains_text", text: "active: boolean", points: 25, feedback: miss },
    ],
  }),
  choiceExercise({
    slug: "ts-status-choice",
    lessonSlug: "unions-and-literals",
    conceptSlug: "ts.union",
    title: "Vəziyyət unionu",
    prompt: "Sorğunun vəziyyəti üçün hansı tip uyğundur?",
    answer: "option-b",
    options: [
      ["option-a", "boolean"],
      ["option-b", "\"loading\" | \"success\" | \"error\""],
      ["option-c", "number[]"],
      ["option-d", "string[]"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-status-union",
    lessonSlug: "unions-and-literals",
    conceptSlug: "ts.literal",
    title: "Üç vəziyyət",
    prompt: "status dəyişənini loading, success və error literal-ları ilə yaz.",
    instructions: "Kod icra olunmur. Üç söz və ayırıcı görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "let status: string;\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["\"loading\"", "|", "\"success\"", "|", "\"error\""],
        points: 100,
        feedback: miss,
      },
    ],
  }),
  codeExercise({
    slug: "ts-status-word",
    lessonSlug: "unions-and-literals",
    conceptSlug: "ts.union",
    title: "Union mətni",
    prompt: "string və number qəbul edən unionu bir sətirdə yaz.",
    instructions: "Yalnız union mətnini yaz. Kod icra olunmur.",
    difficulty: "easy",
    position: 3,
    starterCode: "",
    language: null,
    rules: [
      {
        type: "exact_text",
        text: "string | number",
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-product-choice",
    lessonSlug: "typescript-interfaces",
    conceptSlug: "ts.interface",
    title: "Məhsul müqaviləsi",
    prompt: "Məhsulun sahələrini adlandırmaq üçün hansı yazılış uyğundur?",
    answer: "option-a",
    options: [
      ["option-a", "interface Product { id: number; title: string; price: number }"],
      ["option-b", "array Product = number"],
      ["option-c", "function Product(): string"],
      ["option-d", "const Product: boolean = true"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-product-interface",
    lessonSlug: "typescript-interfaces",
    conceptSlug: "ts.interface",
    title: "Product interface",
    prompt: "id, title və price sahələri olan Product interface-ini yaz.",
    instructions: "Kod icra olunmur. Interface və üç sahə görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "interface Product {\n}\n",
    language: "javascript",
    rules: [
      { type: "contains_text", text: "interface Product", points: 40, feedback: miss },
      { type: "contains_text", text: "title: string", points: 30, feedback: miss },
      { type: "contains_text", text: "price: number", points: 30, feedback: miss },
    ],
  }),
  choiceExercise({
    slug: "ts-return-place",
    lessonSlug: "function-types",
    conceptSlug: "ts.function",
    title: "Nəticə tipi",
    prompt: "function add(a: number, b: number): number sətrində son number nəyi bildirir?",
    answer: "option-c",
    options: [
      ["option-a", "CSS rəngini"],
      ["option-b", "Massivin uzunluğunu"],
      ["option-c", "Funksiyanın qaytardığı tipi"],
      ["option-d", "HTML elementini"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-typed-add",
    lessonSlug: "function-types",
    conceptSlug: "ts.function",
    title: "Tipli toplama",
    prompt: "İki number qəbul edib onların cəmini number kimi qaytaran add funksiyasını yaz.",
    instructions: "Kod icra olunmur. Parametr, nəticə tipi və return görünməlidir.",
    difficulty: "advanced",
    position: 2,
    starterCode: "function add(a, b) {\n  return a + b;\n}\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["function add", "a: number", "b: number", "): number", "return a + b"],
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-optional-mark",
    lessonSlug: "optional-and-readonly",
    conceptSlug: "ts.optional",
    title: "Buraxıla bilən sahə",
    prompt: "Ləqəb həmişə gəlmirsə, sahə necə yazılır?",
    answer: "option-b",
    options: [
      ["option-a", "nickname: string"],
      ["option-b", "nickname?: string"],
      ["option-c", "readonly nickname: number"],
      ["option-d", "nickname[]: boolean"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-user-optional",
    lessonSlug: "optional-and-readonly",
    conceptSlug: "ts.readonly",
    title: "Sabit id",
    prompt: "readonly id və optional nickname olan qısa User interface-i yaz.",
    instructions: "Kod icra olunmur. Hər iki işarə görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "interface User {\n  name: string;\n}\n",
    language: "javascript",
    rules: [
      { type: "contains_text", text: "readonly id", points: 50, feedback: miss },
      { type: "contains_text", text: "nickname?:", points: 50, feedback: miss },
    ],
  }),
  choiceExercise({
    slug: "ts-narrow-check",
    lessonSlug: "type-narrowing",
    conceptSlug: "ts.narrowing",
    title: "Qolu seçmək",
    prompt: "string | number dəyərində mətn metodunu harada çağırmaq təhlükəsizdir?",
    answer: "option-a",
    options: [
      ["option-a", "typeof value === \"string\" yoxlamasının içində"],
      ["option-b", "Yoxlamadan əvvəl, birbaşa"],
      ["option-c", "Yalnız number qolunda"],
      ["option-d", "CSS selektorunun içində"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-narrow-string",
    lessonSlug: "type-narrowing",
    conceptSlug: "ts.narrowing",
    title: "String qolu",
    prompt: "value string olduqda toUpperCase çağıran if bloku yaz.",
    instructions: "Kod icra olunmur. typeof yoxlaması görünməlidir.",
    difficulty: "intermediate",
    position: 2,
    starterCode: "function label(value: string | number) {\n}\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["typeof value === \"string\"", "toUpperCase"],
        points: 100,
        feedback: miss,
      },
    ],
  }),
  choiceExercise({
    slug: "ts-identity-choice",
    lessonSlug: "generics-basics",
    conceptSlug: "ts.generic",
    title: "Eyni tip",
    prompt: "identity funksiyası arqumentin tipini nəticədə necə saxlayır?",
    answer: "option-c",
    options: [
      ["option-a", "Həmişə number qaytarır"],
      ["option-b", "Tipi silir"],
      ["option-c", "Eyni T tipini qəbul edib qaytarır"],
      ["option-d", "Yalnız boolean qəbul edir"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  codeExercise({
    slug: "ts-identity-function",
    lessonSlug: "generics-basics",
    conceptSlug: "ts.generic",
    title: "identity",
    prompt: "Dəyəri dəyişmədən qaytaran identity generic funksiyasını yaz.",
    instructions: "Kod icra olunmur. T həm parametrdə, həm nəticədə görünməlidir.",
    difficulty: "advanced",
    position: 2,
    starterCode: "function identity(value) {\n  return value;\n}\n",
    language: "javascript",
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["function identity<T>", "value: T", "): T", "return value"],
        points: 100,
        feedback: miss,
      },
    ],
  }),
];
