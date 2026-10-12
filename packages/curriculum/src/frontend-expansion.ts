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

function draft(input: {
  slug: string;
  title: string;
  objective: string;
  position: number;
  conceptSlug: string;
}): LessonDefinition {
  return {
    slug: input.slug,
    title: input.title,
    objective: input.objective,
    position: input.position,
    estimatedMinutes: 20,
    status: "draft",
    concepts: [{ conceptSlug: input.conceptSlug, role: "primary" }],
    blocks: [],
  };
}

const choice = (optionId: string): ExerciseDefinition["rules"] => [
  {
    type: "choice_equals",
    optionId,
    points: 100,
    feedback: "Bu variant bu sualın cavabı deyil. Dərsdəki fərqi bir daha oxu.",
  },
];

export const expansionConcepts: ConceptDefinition[] = [
  {
    slug: "html.document",
    name: "HTML sənədi",
    domain: "html",
    summary: "HTML sənədi doctype, html, head və body hissələrindən ibarətdir.",
  },
  {
    slug: "html.semantic",
    name: "Semantik HTML",
    domain: "html",
    summary: "Semantik element bölmənin mənasını deyir: header, main, nav, footer.",
  },
  {
    slug: "html.a11y",
    name: "Əlçatanlıq",
    domain: "html",
    summary: "Şəkil üçün alt mətni və keçid üçün aydın mətn səhifəni oxunaqlı edir.",
  },
  {
    slug: "css.box-model",
    name: "Box model",
    domain: "css",
    summary: "Hər elementin content, padding, border və margin qatları var.",
  },
  {
    slug: "css.display",
    name: "Display",
    domain: "css",
    summary: "display elementin sətir, blok və ya flex qutusu kimi duracağını seçir.",
  },
  {
    slug: "css.flexbox",
    name: "Flexbox",
    domain: "css",
    summary: "Flex container uşaqları bir ox boyunca düzür.",
  },
  {
    slug: "css.responsive",
    name: "Responsive dizayn",
    domain: "css",
    summary: "Səhifə dar ekranda da oxunaqlı qalmalıdır.",
  },
  {
    slug: "js.variable",
    name: "Dəyişən",
    domain: "javascript",
    summary: "Dəyişən bir dəyəri ad altında saxlayır.",
  },
  {
    slug: "js.condition",
    name: "Şərt",
    domain: "javascript",
    summary: "if şərti doğru olanda bir budağı, yoxsa o birini işlədir.",
  },
  {
    slug: "js.loop",
    name: "Dövr",
    domain: "javascript",
    summary: "Dövr eyni addımı siyahı bitənə qədər təkrarlayır.",
  },
  {
    slug: "js.function",
    name: "Funksiya",
    domain: "javascript",
    summary: "Funksiya adlandırılmış bir işi arqumentlərlə yerinə yetirir və nəticə qaytara bilər.",
  },
  {
    slug: "js.array",
    name: "Massiv",
    domain: "javascript",
    summary: "Massiv sıralı dəyərlər siyahısıdır.",
  },
  {
    slug: "js.object",
    name: "Obyekt",
    domain: "javascript",
    summary: "Obyekt açar və dəyər cütlərindən ibarət qeyddir.",
  },
  {
    slug: "css.position",
    name: "Position",
    domain: "css",
    summary: "Position elementi normal axından çıxarmaq üçündür. Bu dərs hələ dərc olunmayıb.",
  },
  {
    slug: "css.grid",
    name: "CSS Grid",
    domain: "css",
    summary: "Grid səhifəni sətir və sütunlara bölür. Bu dərs hələ dərc olunmayıb.",
  },
  {
    slug: "js.dom",
    name: "DOM",
    domain: "javascript",
    summary: "DOM səhifənin proqramın oxuduğu ağacıdır. Bu dərs hələ dərc olunmayıb.",
  },
  {
    slug: "js.event",
    name: "Hadisə",
    domain: "javascript",
    summary: "Hadisə klik və ya yazı kimi istifadəçi əməlidir. Bu dərs hələ dərc olunmayıb.",
  },
  {
    slug: "js.async",
    name: "Async",
    domain: "javascript",
    summary: "Async iş cavabı gözləyir və səhifəni dondurmur. Bu dərs hələ dərc olunmayıb.",
  },
  {
    slug: "js.fetch",
    name: "Fetch",
    domain: "javascript",
    summary: "fetch serverdən məlumat istəyir. Bu dərs hələ dərc olunmayıb.",
  },
];

export const expansionPrerequisites: ConceptPrerequisite[] = [
  { conceptSlug: "html.document", prerequisiteSlug: "web.html" },
  { conceptSlug: "html.semantic", prerequisiteSlug: "html.elements" },
  { conceptSlug: "html.a11y", prerequisiteSlug: "html.semantic" },
  { conceptSlug: "css.box-model", prerequisiteSlug: "css.selector" },
  { conceptSlug: "css.display", prerequisiteSlug: "css.box-model" },
  { conceptSlug: "css.flexbox", prerequisiteSlug: "css.display" },
  { conceptSlug: "css.responsive", prerequisiteSlug: "css.flexbox" },
  { conceptSlug: "js.variable", prerequisiteSlug: "web.javascript" },
  { conceptSlug: "js.condition", prerequisiteSlug: "js.value" },
  { conceptSlug: "js.loop", prerequisiteSlug: "js.condition" },
  { conceptSlug: "js.function", prerequisiteSlug: "js.loop" },
  { conceptSlug: "js.array", prerequisiteSlug: "js.function" },
  { conceptSlug: "js.object", prerequisiteSlug: "js.array" },
  { conceptSlug: "css.position", prerequisiteSlug: "css.display" },
  { conceptSlug: "css.grid", prerequisiteSlug: "css.display" },
  { conceptSlug: "js.dom", prerequisiteSlug: "js.object" },
  { conceptSlug: "js.event", prerequisiteSlug: "js.dom" },
  { conceptSlug: "js.async", prerequisiteSlug: "js.function" },
  { conceptSlug: "js.fetch", prerequisiteSlug: "js.async" },
];

export const documentLesson = lesson({
  slug: "html-document-structure",
  title: "HTML sənədinin quruluşu",
  objective: "doctype, html, head və body hissələrinin işini ayırd etmək.",
  position: 4,
  minutes: 16,
  primary: "html.document",
  supporting: ["web.html"],
  paragraphs: [
    "HTML sənədi bir səhifənin skeletidir. İlk sətir <!DOCTYPE html> brauzerə bunun müasir HTML olduğunu deyir.",
    "html elementi bütün sənədi saxlayır. head görünməyən məlumatdır: başlıq və dil. body isə ekranda görünən hissədir.",
    "Başlıq h1 body-nin içində olmalıdır. Onu head-ə yazmaq səhifənin görünən mətnini ora qoymur.",
    'Kiçik skelet: <!DOCTYPE html>, sonra html, onun içində head və body.',
  ],
  question: "Səhifədə görünən başlıq head-də yazılır, yoxsa body-də? Niyə?",
  rubric: [
    "Görünən məzmun body-dədir",
    "head başlıq və digər görünməyən məlumat üçündür",
    "DOCTYPE sənədin HTML olduğunu bildirir",
  ],
  points: ["DOCTYPE sənədin növünü deyir", "head məlumatdır", "body görünən hissədir"],
  practice: "Boş bir HTML skeleti yaz: doctype, html, head və body.",
});

export const semanticLesson = lesson({
  slug: "semantic-html",
  title: "Semantik HTML",
  objective: "header, nav, main və footer ilə səhifənin mənasını yazmaq.",
  position: 4,
  minutes: 18,
  primary: "html.semantic",
  supporting: ["html.elements"],
  paragraphs: [
    "div hər şeyi saxlaya bilər, amma brauzerə və oxucuya həmin bölmənin nə olduğunu demir.",
    "header səhifənin yuxarı hissəsidir. nav keçidlər qrupudur. main əsas məzmundur. footer isə alt məlumatdır.",
    "Bir səhifədə adətən bir main olur. Naviqasiya keçidləri nav-ın içində qalır, əsas məqalə isə main-də.",
    "Semantik element div-i qadağan etmir. Mənası olan bölmə üçün mənası olan elementi seç.",
  ],
  question: "Portfolio səhifəsində ad, keçidlər və əsas mətn hansı elementlərdə durmalıdır?",
  rubric: [
    "Yuxarı hissə header ola bilər",
    "Keçidlər nav içindədir",
    "Əsas mətn main içindədir",
  ],
  points: ["header yuxarı hissədir", "nav keçidlərdir", "main əsas məzmundur", "footer alt hissədir"],
  practice: "header, nav, main və footer olan qısa bir səhifə skeleti yaz.",
});

export const a11yLesson = lesson({
  slug: "images-and-accessibility",
  title: "Şəkillər və əlçatanlıq",
  objective: "Şəkilə alt mətni vermək və keçidin mətnini aydın yazmaq.",
  position: 5,
  minutes: 16,
  primary: "html.a11y",
  supporting: ["html.semantic", "html.attributes"],
  paragraphs: [
    "img elementi şəkli göstərir. src faylın ünvanıdır. alt isə şəkli görməyən adama həmin şəklin nə olduğunu deyir.",
    'Nümunə: <img src="portrait.png" alt="Aysel masada oturub">. Boş alt yalnız şəklin heç bir məlumat daşımadığını deyir.',
    "Keçidin mətni də aydın olmalıdır. «Bura kliklə» hara getdiyini demir. «Portfolio» və ya «Sənədlər» deyir.",
    "Əlçatan səhifə yalnız gözlə oxunan səhifə deyil. Mətn və alt atributu mənanı saxlayır.",
  ],
  question: "Şəkli görməyən istifadəçi onun nə olduğunu haradan bilir?",
  rubric: [
    "alt atributu şəkli təsvir edir",
    "src yalnız faylın ünvanıdır",
    "Keçidin mətni hara getdiyini deməlidir",
  ],
  points: ["img şəkli göstərir", "alt təsvirdir", "Keçid mətni konkret olmalıdır"],
  practice: "Bir şəkil yaz və alt mətnində şəkildə nə göründüyünü bir cümlə ilə de.",
});

export const selectorLesson = lesson({
  slug: "css-selectors",
  title: "CSS selektorları",
  objective: "Element və class selektoru ilə hansı qutunun stilləşəcəyini seçmək.",
  position: 1,
  minutes: 18,
  primary: "css.selector",
  supporting: ["web.css"],
  paragraphs: [
    "CSS qaydası iki hissədən ibarətdir: selektor və bəyannamə bloku. Selektor kimi elementlərə qaydanın tətbiq olunacağını deyir.",
    "p selektoru bütün paraqrafları seçir. .card selektoru class atributu card olan elementləri seçir.",
    "Selektor xassə deyil. color xassədir, p isə həmin xassənin kimə aid olduğunu seçir.",
    "Səhv selektor səhifəni pozmur, sadəcə gözlədiyin elementə dəymir.",
  ],
  question: "p və .card selektorları nəyi fərqli seçir?",
  rubric: [
    "p elementin adına görə seçir",
    ".card class atributuna görə seçir",
    "Selektor xassənin özü deyil",
  ],
  points: ["Selektor hədəfi seçir", "Element selektoru teq adıdır", "Class selektoru nöqtə ilə başlayır"],
  practice: "Bütün h1 elementlərinin rəngini dəyişən bir selektor yaz.",
});

export const boxLesson = lesson({
  slug: "css-box-model",
  title: "Box model",
  objective: "content, padding, border və margin qatlarını ayırd etmək.",
  position: 2,
  minutes: 16,
  primary: "css.box-model",
  supporting: ["css.selector"],
  paragraphs: [
    "Hər HTML elementi bir qutudur. İçəridə content var: mətn və ya şəkil.",
    "padding content ilə sərhəd arasındakı boşluqdur. border sərhədin özüdür. margin isə qutunun xaricindəki boşluqdur.",
    "İki kartın bir-birinə yapışmaması üçün margin lazımdır. Mətnin sərhədə dirənməməsi üçün padding.",
    "padding daxildir, margin xaricidir. Onları dəyiş-dəyiş etmək boşluğu səhv yerə qoyur.",
  ],
  question: "Mətn ilə sərhəd arasındakı boşluq padding-dir, yoxsa margin? İki qutu arasındakı boşluq hansıdır?",
  rubric: [
    "padding contentin daxilindəki boşluqdur",
    "margin qutunun xaricindədir",
    "border sərhəddir",
  ],
  points: ["content içlikdir", "padding daxili boşluqdur", "margin xarici boşluqdur"],
  practice: "Bir class üçün padding və margin yaz və hansının daxildə olduğunu de.",
});

export const displayLesson = lesson({
  slug: "css-display",
  title: "Display",
  objective: "block, inline və flex dəyərlərinin yerləşmə fərqini seçmək.",
  position: 3,
  minutes: 16,
  primary: "css.display",
  supporting: ["css.box-model"],
  paragraphs: [
    "display elementin qonşuları ilə necə duracağını seçir. Bu, rəng və ya margin deyil.",
    "block element yeni sətirdən başlayır və üfüqi yeri tutur. p və div adətən block-dur.",
    "inline element mətnin içində qalır və yeni sətir açmır. a və span adətən inline-dır.",
    "display: flex elementi flex container edir. Uşaqların ox boyu düzülməsi bundan sonra gəlir. Flex-in özü növbəti dərsdədir.",
  ],
  question: "Yeni sətirdən başlayan element üçün block, mətnin içində qalan üçün hansı display uyğundur?",
  rubric: [
    "block yeni sətir açır",
    "inline mətn axınında qalır",
    "flex uşaqları bir konteynerdə düzür",
  ],
  points: ["display yerləşməni seçir", "block sətir açır", "inline axında qalır"],
  practice: "Bir div-i block, bir span-ı inline saxlayan iki qayda yaz.",
});

export const flexLesson = lesson({
  slug: "css-flexbox",
  title: "Flexbox",
  objective: "Flex container və əsas oxu ilə elementləri yan-yana düzmək.",
  position: 4,
  minutes: 20,
  primary: "css.flexbox",
  supporting: ["css.display", "css.box-model"],
  paragraphs: [
    "Flexbox bir konteynerin içindəki uşaqları düzür. Konteyner display: flex alan elementdir. Uşaqlar isə flex item-dir.",
    "Əsas ox üfüqidir, flex-direction: row olanda. flex-direction: column olanda əsas ox şaquli olur.",
    "justify-content elementləri əsas ox boyunca yayır. space-between birinci və sonuncunu kənarlara qoyur.",
    "Flex işləmirsə, əvvəl container-də display: flex olub-olmadığını yoxla. Uşağa flex vermək konteyneri yaratmır.",
  ],
  question: "Yan-yana üç kart üçün display və flex-direction haraya yazılır?",
  rubric: [
    "display: flex valideynə yazılır",
    "Uşaqlar flex item olur",
    "row üfüqi oxdur",
  ],
  points: ["Container display: flex olur", "row üfüqi, column şaqulidir", "justify-content əsas oxu tutur"],
  practice: "Üç uşağı yan-yana düzən bir .row qaydası yaz.",
});

export const responsiveLesson = lesson({
  slug: "css-responsive",
  title: "Responsive dizayn",
  objective: "Dar ekranda səhifənin daşmadan oxunaqlı qalmasını təmin etmək.",
  position: 5,
  minutes: 18,
  primary: "css.responsive",
  supporting: ["css.flexbox"],
  paragraphs: [
    "Responsive səhifə bir enə bağlanmır. Geniş pəncərədə kartlar yan-yana, dar telefonda isə alt-alta dura bilər.",
    "Sabit 1200px en dar ekranda üfüqi sürüşdürmə yaradır. max-width və faiz eni qutunu konteynerin içində saxlayır.",
    "Media query ekranın eninə görə qayda seçir. Məsələn, en 700px-dən kiçik olanda flex-direction: column yazılır.",
    "Əvvəl oxunaqlı telefon görünüşünü yoxla, sonra geniş ekranı. Portfolio səhifəsi də hər iki endə oxunmalıdır.",
  ],
  question: "Telefon enində yan-yana kartlar daşırsa, hansı dəyişiklik onları alt-alta salır?",
  rubric: [
    "Dar ekran üçün media query işlənir",
    "flex-direction: column alt-alta düzür",
    "Sabit böyük en daşmaya səbəb olur",
  ],
  points: ["En ekrana uyğun olmalıdır", "Media query şərti qaydadır", "column dar ekrana uyğundur"],
  practice: "700px-dən dar ekranda .row üçün flex-direction: column yaz.",
});

export const basicsLesson = lesson({
  slug: "js-basics",
  title: "JavaScript əsasları",
  objective: "JavaScript-in səhifədə davranış olduğunu və təlimatın ardıcıl işlədiyini izah etmək.",
  position: 1,
  minutes: 16,
  primary: "web.javascript",
  supporting: ["web.html"],
  paragraphs: [
    "JavaScript brauzerin oxuduğu təlimatlardır. HTML quruluşu, CSS görünüşü saxlayır. JavaScript isə düymə, hesab və dəyişən kimi davranışı yazır.",
    "Bir təlimat adətən bir sətirdə bitir. Proqram yuxarıdan aşağı işləyir: əvvəl elan, sonra istifadə.",
    "Bu modulda əvvəl dəyişən və tip, sonra şərt, dövr, funksiya, massiv və obyekt gəlir. DOM və server sorğusu onların üstündə durur və hələ dərc olunmayıb.",
    "JavaScript HTML-i əvəz etmir. Səhifənin mətnini hələ də elementlə yazırsan.",
  ],
  question: "Səhifənin görünən quruluşu JavaScript-dir, yoxsa HTML? Davranış hansına aiddir?",
  rubric: [
    "Quruluş HTML-dir",
    "Davranış JavaScript-dir",
    "Təlimatlar ardıcıl oxunur",
  ],
  points: ["JavaScript davranışdır", "HTML quruluşdur", "Təlimatlar yuxarıdan aşağı işləyir"],
  practice: "Bir düymənin mətni üçün HTML, basılanda dəyişən rəqəm üçün JavaScript lazım olduğunu bir cümlə ilə yaz.",
});

export const variableLesson = lesson({
  slug: "js-variables",
  title: "Dəyişənlər",
  objective: "let və const ilə dəyəri ad altında saxlamaq.",
  position: 2,
  minutes: 16,
  primary: "js.variable",
  supporting: ["web.javascript"],
  paragraphs: [
    "Dəyişən bir dəyərə ad verir. Sonra həmin adı yazanda proqram dəyəri tapır.",
    "const sonradan başqa dəyərə bağlanmayacaq ad üçündür. let isə sonra dəyişə bilən ad üçündür.",
    "const score = 10; score adını 10-a bağlayır. Adın özü dəyər deyil, dəyərin etiketidir.",
    "Adı mənalı seç: x əvəzinə score. Ad dəyərin tipini dəyişmir.",
  ],
  question: "Bir daha dəyişməyəcək ad üçün let, yoxsa const uyğundur?",
  rubric: ["const dəyişməyən bağlama üçündür", "let sonra dəyişə bilər", "Ad dəyərin etiketidir"],
  points: ["Dəyişən dəyəri adlandırır", "const sabit bağlayır", "let dəyişə bilər"],
  practice: "Şəhər adını saxlayan bir const yaz.",
});

export const typesLesson = lesson({
  slug: "js-values",
  title: "Dəyərlər və tiplər",
  objective: "number, string və boolean dəyərlərini ayırd etmək.",
  position: 3,
  minutes: 16,
  primary: "js.value",
  supporting: ["js.variable"],
  paragraphs: [
    "Dəyər proqramın işlətdiyi konkret məlumatdır. Tip həmin dəyərin növüdür.",
    "10 number-dir. \"10\" string-dir, yəni mətndir. true və false boolean-dır.",
    "Dəyişən tipi özü daşımır. const label = \"10\" mətn saxlayır, ədəd yox.",
    "Mətni ədədlə toplamaq onları həmişə riyazi cəm etmir. Tipi əvvəl yoxla.",
  ],
  question: "10 və \"10\" eyni tipdirmi? true hansı tipdədir?",
  rubric: ["10 number-dir", "\"10\" string-dir", "true boolean-dır"],
  points: ["number ədəddir", "string mətndir", "boolean doğru və ya yalandır"],
  practice: "Bir ədəd, bir mətn və bir boolean saxlayan üç const yaz.",
});

export const conditionLesson = lesson({
  slug: "js-conditions",
  title: "Şərtlər",
  objective: "if və else ilə iki budaqdan birini seçmək.",
  position: 4,
  minutes: 16,
  primary: "js.condition",
  supporting: ["js.value"],
  paragraphs: [
    "Şərt bir sualdır. Cavab true olanda if-in içi işləyir. false olanda else varsa, o işləyir.",
    "if (score >= 60) keçdi budağıdır. else isə qalan hallardır.",
    "Şərtin özü boolean dəyər verir. Ədədi şərtin yerinə yazmaq sualı əvəz etmir.",
    "Bir şərt bütün proqramı əvəz etmir. O, yalnız hansı budağın işləyəcəyini seçir.",
  ],
  question: "score 60-dan kiçik olanda hansı budaq işləyir: if (score >= 60), yoxsa else?",
  rubric: ["Şərt false olanda if bloku keçilir", "else qalan hal üçündür", ">= müqayisə operatorudur"],
  points: ["if doğru budaqdır", "else yalan budaqdır", "Şərt boolean verir"],
  practice: "Ədəd mənfidirsə bir mətn, deyilsə başqa mətn qaytaran if yaz.",
});

export const loopLesson = lesson({
  slug: "js-loops",
  title: "Dövrlər",
  objective: "Siyahının hər elementinə eyni addımı tətbiq etmək.",
  position: 5,
  minutes: 16,
  primary: "js.loop",
  supporting: ["js.condition"],
  paragraphs: [
    "Dövr eyni addımı təkrarlayır. for dövrü sayğacla işləyir: başlanğıc, şərt, addım.",
    "for (const item of items) siyahının hər dəyərini bir dəfə item adına qoyur.",
    "Şərt heç vaxt false olmazsa dövr bitmir. Sayğacı artırmaq və ya siyahını gəzmək onu bitirir.",
    "Dövr şərtin əvəzi deyil. Şərt bir dəfə seçir, dövr isə təkrarlayır.",
  ],
  question: "Üç addan ibarət siyahının hər adı üçün bir dəfə işləyən konstruksiya şərt, yoxsa dövr?",
  rubric: ["Dövr hər element üçün təkrarlanır", "of siyahını gəzir", "Bitməyən şərt dövrü dayandırmır"],
  points: ["Dövr təkrarlayır", "for...of hər dəyəri gəzir", "Şərt dövrü dayandıra bilər"],
  practice: "Üç ədədlik siyahının hər elementini bir dəyişənə yazan for...of nümunəsi qur.",
});

export const functionLesson = lesson({
  slug: "js-functions",
  title: "Funksiyalar",
  objective: "Arqument qəbul edən və nəticə qaytaran funksiya yazmaq.",
  position: 6,
  minutes: 18,
  primary: "js.function",
  supporting: ["js.loop"],
  paragraphs: [
    "Funksiya bir işə ad verir. function double(n) n arqumentini qəbul edir.",
    "return funksiyanın nəticəsidir. return-suz funksiya işi görə bilər, amma çağıran tərəfə dəyər vermir.",
    "double(4) çağırışı n-i 4 edir. Funksiyanın adı çağırışın özü deyil.",
    "Eyni funksiyanı bir neçə ədədlə çağırmaq olar. Hər çağırış öz arqumentini gətirir.",
  ],
  question: "Funksiyanın çağırana verdiyi nəticə harada yazılır: parametrin adında, yoxsa return-da?",
  rubric: ["return nəticəni qaytarır", "Parametr daxil olan dəyərdir", "Çağırış arqumenti ötürür"],
  points: ["Funksiya işi adlandırır", "Parametr daxil olur", "return nəticə verir"],
  practice: "Bir ədədi ikiqat artıran double funksiyası yaz.",
});

export const arrayLesson = lesson({
  slug: "js-arrays",
  title: "Massivlər",
  objective: "Sıralı siyahı yaratmaq və elementə indeks ilə çatmaq.",
  position: 7,
  minutes: 16,
  primary: "js.array",
  supporting: ["js.function"],
  paragraphs: [
    "Massiv kvadrat mötərizədə yazılan sıralı siyahıdır: [\"HTML\", \"CSS\", \"JavaScript\"].",
    "Birinci elementin indeksi 0-dır. names[0] ilk adı verir. names.length uzunluqdur.",
    "Massiv dəyişənin özü deyil. const names = [...] siyahını ad altında saxlayır.",
    "Siyahını gəzmək üçün dövr və ya funksiya işlədilir. İndeks sıra nömrəsidir, elementin məzmunu deyil.",
  ],
  question: "Üç elementli massivdə sonuncu elementin indeksi neçədir?",
  rubric: ["İndeks 0-dan başlayır", "Sonuncu indeks 2-dir", "length 3-dür"],
  points: ["Massiv sıralı siyahıdır", "İndeks 0-dan başlayır", "length element sayıdır"],
  practice: "Üç dərs adı olan massiv yaz və birincini indeks ilə seç.",
});

export const objectLesson = lesson({
  slug: "js-objects",
  title: "Obyektlər",
  objective: "Açar və dəyərlə bir qeyd yazmaq.",
  position: 8,
  minutes: 16,
  primary: "js.object",
  supporting: ["js.array"],
  paragraphs: [
    "Obyekt bir qeyddir. Hər məlumatın açarı var: { name: \"Aysel\", city: \"Bakı\" }.",
    "person.name açarı name olan dəyəri oxuyur. Açar indeks deyil, addır.",
    "Massiv sıra saxlayır. Obyekt isə adlı sahələr saxlayır. İkisini dəyişmək qeydi oxunmaz edir.",
    "Bir tələbənin adı və şəhəri üçün obyekt uyğundur. Eyni tipli çoxlu ad üçün massiv uyğundur.",
  ],
  question: "Şagirdin adı və şəhəri üçün massiv, yoxsa obyekt daha aydın qeyddir? Niyə?",
  rubric: ["Obyektin açarları sahənin adıdır", "Massiv yalnız sıra verir", "Nöqtə ilə açar oxunur"],
  points: ["Obyekt açar və dəyərdir", "Açar sahənin adıdır", "Massiv sıra üçündür"],
  practice: "name və city açarları olan bir obyekt yaz.",
});

export const cssDraftLessons: LessonDefinition[] = [
  draft({
    slug: "css-positioning",
    title: "Position",
    objective: "Elementi normal axından necə çıxarmağı öyrənmək.",
    position: 6,
    conceptSlug: "css.position",
  }),
  draft({
    slug: "css-grid",
    title: "CSS Grid",
    objective: "Səhifəni sətir və sütun toruna bölmək.",
    position: 7,
    conceptSlug: "css.grid",
  }),
];

export const jsDraftLessons: LessonDefinition[] = [
  draft({
    slug: "js-dom",
    title: "DOM əsasları",
    objective: "Səhifə ağacından elementi seçmək.",
    position: 9,
    conceptSlug: "js.dom",
  }),
  draft({
    slug: "js-events",
    title: "Hadisələr",
    objective: "Klik hadisəsinə reaksiya yazmaq.",
    position: 10,
    conceptSlug: "js.event",
  }),
  draft({
    slug: "js-async",
    title: "Async JavaScript",
    objective: "Gözləmə tələb edən işi səhifəni dondurmadan yazmaq.",
    position: 11,
    conceptSlug: "js.async",
  }),
  draft({
    slug: "js-fetch",
    title: "Fetch və API",
    objective: "Serverdən məlumat istəmək.",
    position: 12,
    conceptSlug: "js.fetch",
  }),
];

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
    rules: choice(input.answer),
  };
}

export const expansionExercises: ExerciseDefinition[] = [
  choiceExercise({
    slug: "js-behavior",
    lessonSlug: "js-basics",
    conceptSlug: "web.javascript",
    title: "Davranış",
    prompt: "Düymə basılanda rəqəmin dəyişməsi hansı dilin işidir?",
    answer: "option-c",
    options: [
      ["option-a", "HTML"],
      ["option-b", "CSS"],
      ["option-c", "JavaScript"],
      ["option-d", "URL"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  choiceExercise({
    slug: "html-document-body",
    lessonSlug: "html-document-structure",
    conceptSlug: "html.document",
    title: "Görünən hissə",
    prompt: "Səhifədə görünən başlıq hansı hissəyə yazılır?",
    answer: "option-b",
    options: [
      ["option-a", "head"],
      ["option-b", "body"],
      ["option-c", "DOCTYPE"],
      ["option-d", "title atributu"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "html-document-skeleton",
    lessonSlug: "html-document-structure",
    conceptSlug: "html.document",
    title: "Sənəd skeleti",
    prompt: "body elementi olan qısa bir HTML sənədi yaz.",
    instructions: "body teqi lazımdır. Kod brauzerdə işlədilmir.",
    type: "code_text",
    language: "html",
    difficulty: "easy",
    position: 2,
    starterCode: "<!DOCTYPE html>\n<html>\n  <head></head>\n  \n</html>\n",
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "body",
        points: 100,
        feedback: "Görünən hissə body elementinin içindədir.",
      },
    ],
  },
  choiceExercise({
    slug: "semantic-main",
    lessonSlug: "semantic-html",
    conceptSlug: "html.semantic",
    title: "Əsas məzmun",
    prompt: "Səhifənin əsas məzmunu üçün hansı element uyğundur?",
    answer: "option-c",
    options: [
      ["option-a", "nav"],
      ["option-b", "footer"],
      ["option-c", "main"],
      ["option-d", "span"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "semantic-regions",
    lessonSlug: "semantic-html",
    conceptSlug: "html.semantic",
    title: "Bölmələr",
    prompt: "header və main elementləri olan skelet yaz.",
    instructions: "Hər iki element görünməlidir.",
    type: "code_text",
    language: "html",
    difficulty: "easy",
    position: 2,
    starterCode: "<header></header>\n",
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "header",
        points: 50,
        feedback: "Yuxarı hissə üçün header yaz.",
      },
      {
        type: "html_element_exists",
        tag: "main",
        points: 50,
        feedback: "Əsas məzmun üçün main yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "a11y-alt",
    lessonSlug: "images-and-accessibility",
    conceptSlug: "html.a11y",
    title: "Şəklin mətni",
    prompt: "Şəkli görməyən istifadəçiyə təsviri hansı atribut verir?",
    answer: "option-a",
    options: [
      ["option-a", "alt"],
      ["option-b", "src"],
      ["option-c", "href"],
      ["option-d", "class"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "a11y-image",
    lessonSlug: "images-and-accessibility",
    conceptSlug: "html.a11y",
    title: "Alt mətn",
    prompt: "alt atributu dolu olan bir img elementi yaz.",
    instructions: "alt boş olmamalıdır.",
    type: "code_text",
    language: "html",
    difficulty: "intermediate",
    position: 2,
    starterCode: '<img src="portrait.png" alt="">',
    published: true,
    options: [],
    rules: [
      {
        type: "html_element_exists",
        tag: "img",
        points: 40,
        feedback: "Şəkil img elementidir.",
      },
      {
        type: "regex",
        pattern: "alt\\s*=\\s*\"[^\"]+\"",
        points: 60,
        feedback: "alt atributuna şəklin təsvirini yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "css-selector-class",
    lessonSlug: "css-selectors",
    conceptSlug: "css.selector",
    title: "Class selektoru",
    prompt: "class atributu card olan elementi hansı selektor seçir?",
    answer: "option-b",
    options: [
      ["option-a", "p"],
      ["option-b", ".card"],
      ["option-c", "#card"],
      ["option-d", "color"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "css-selector-element",
    lessonSlug: "css-selectors",
    conceptSlug: "css.selector",
    title: "Element selektoru",
    prompt: "Bütün h1 elementləri üçün rəng yaz.",
    instructions: "Selektor h1 olmalıdır.",
    type: "code_text",
    language: "css",
    difficulty: "easy",
    position: 2,
    starterCode: "h1 {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "h1\\s*\\{[^}]*color\\s*:",
        points: 100,
        feedback: "h1 selektorunun blokunda color xassəsi olmalıdır.",
      },
    ],
  },
  choiceExercise({
    slug: "css-selector-challenge",
    lessonSlug: "css-selectors",
    conceptSlug: "css.selector",
    title: "Selektor fərqi",
    prompt: "Hansı yazı xassə deyil, hədəfi seçir?",
    answer: "option-a",
    options: [
      ["option-a", ".card"],
      ["option-b", "color"],
      ["option-c", "margin"],
      ["option-d", "16px"],
    ],
    difficulty: "advanced",
    position: 3,
  }),
  choiceExercise({
    slug: "css-box-padding",
    lessonSlug: "css-box-model",
    conceptSlug: "css.box-model",
    title: "Daxili boşluq",
    prompt: "Mətn ilə sərhəd arasındakı boşluq hansıdır?",
    answer: "option-a",
    options: [
      ["option-a", "padding"],
      ["option-b", "margin"],
      ["option-c", "display"],
      ["option-d", "color"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "css-box-margin",
    lessonSlug: "css-box-model",
    conceptSlug: "css.box-model",
    title: "Xarici boşluq",
    prompt: ".card üçün margin yaz.",
    instructions: "margin xassəsi lazımdır.",
    type: "code_text",
    language: "css",
    difficulty: "easy",
    position: 2,
    starterCode: ".card {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "\\.card\\s*\\{[^}]*margin\\s*:",
        points: 100,
        feedback: ".card blokunda margin yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "css-display-block",
    lessonSlug: "css-display",
    conceptSlug: "css.display",
    title: "Yeni sətir",
    prompt: "Yeni sətirdən başlayan qutu üçün hansı display uyğundur?",
    answer: "option-a",
    options: [
      ["option-a", "block"],
      ["option-b", "inline"],
      ["option-c", "none"],
      ["option-d", "color"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "css-display-flex",
    lessonSlug: "css-display",
    conceptSlug: "css.display",
    title: "Flex container",
    prompt: ".row elementini flex container et.",
    instructions: "display xassəsi lazımdır.",
    type: "code_text",
    language: "css",
    difficulty: "easy",
    position: 2,
    starterCode: ".row {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "\\.row\\s*\\{[^}]*display\\s*:\\s*flex",
        points: 100,
        feedback: ".row üçün display: flex yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "css-flex-container",
    lessonSlug: "css-flexbox",
    conceptSlug: "css.flexbox",
    title: "Konteyner",
    prompt: "Uşaqları düzən display: flex haraya yazılır?",
    answer: "option-a",
    options: [
      ["option-a", "Valideyn elementə"],
      ["option-b", "Yalnız birinci uşağa"],
      ["option-c", "head elementinə"],
      ["option-d", "URL ünvanına"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  choiceExercise({
    slug: "css-flex-axis",
    lessonSlug: "css-flexbox",
    conceptSlug: "css.flexbox",
    title: "Əsas ox",
    prompt: "Uşaqları üfüqi, yan-yana düzmək üçün hansı istiqamət uyğundur?",
    answer: "option-b",
    options: [
      ["option-a", "column"],
      ["option-b", "row"],
      ["option-c", "padding"],
      ["option-d", "inline"],
    ],
    difficulty: "easy",
    position: 2,
  }),
  {
    slug: "css-flex-row",
    lessonSlug: "css-flexbox",
    conceptSlug: "css.flexbox",
    title: "Sətir düzümü",
    prompt: ".row üçün display: flex və flex-direction: row yaz.",
    instructions: "Hər iki xassə eyni qaydada olmalıdır.",
    type: "code_text",
    language: "css",
    difficulty: "intermediate",
    position: 3,
    starterCode: ".row {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "display\\s*:\\s*flex",
        points: 50,
        feedback: "Container üçün display: flex yaz.",
      },
      {
        type: "regex",
        pattern: "flex-direction\\s*:\\s*row",
        points: 50,
        feedback: "Üfüqi ox üçün flex-direction: row yaz.",
      },
    ],
  },
  {
    slug: "css-flex-repair",
    lessonSlug: "css-flexbox",
    conceptSlug: "css.flexbox",
    title: "Sınmış sətir",
    prompt: "Uşaqlar alt-alta qalıb. Onları yan-yana yığmaq üçün .row qaydasını düzəlt.",
    instructions: "display: flex və flex-direction: row lazımdır.",
    type: "code_text",
    language: "css",
    difficulty: "advanced",
    position: 4,
    starterCode: ".row {\n  display: block;\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "display\\s*:\\s*flex",
        points: 60,
        feedback: "block uşaqları yan-yana düzmür. display: flex yaz.",
      },
      {
        type: "regex",
        pattern: "flex-direction\\s*:\\s*row",
        points: 40,
        feedback: "Yan-yana düzüm üçün flex-direction: row əlavə et.",
      },
    ],
  },
  choiceExercise({
    slug: "css-responsive-column",
    lessonSlug: "css-responsive",
    conceptSlug: "css.responsive",
    title: "Dar ekran",
    prompt: "Dar ekranda kartları alt-alta salan istiqamət hansıdır?",
    answer: "option-c",
    options: [
      ["option-a", "row"],
      ["option-b", "margin"],
      ["option-c", "column"],
      ["option-d", "inline"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "css-responsive-query",
    lessonSlug: "css-responsive",
    conceptSlug: "css.responsive",
    title: "Media query",
    prompt: "Dar ekran üçün flex-direction: column yazan bir media query yaz.",
    instructions: "max-width və column sözləri lazımdır.",
    type: "code_text",
    language: "css",
    difficulty: "advanced",
    position: 2,
    starterCode: "@media (max-width: 700px) {\n  .row {\n  }\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "regex",
        pattern: "@media[^{]*max-width",
        points: 50,
        feedback: "Dar ekranı max-width ilə seç.",
      },
      {
        type: "regex",
        pattern: "flex-direction\\s*:\\s*column",
        points: 50,
        feedback: "Dar ekranda flex-direction: column yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "js-const-binding",
    lessonSlug: "js-variables",
    conceptSlug: "js.variable",
    title: "Sabit ad",
    prompt: "Bir daha dəyişməyəcək ad üçün hansı açar söz uyğundur?",
    answer: "option-b",
    options: [
      ["option-a", "function"],
      ["option-b", "const"],
      ["option-c", "return"],
      ["option-d", "import"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-const-city",
    lessonSlug: "js-variables",
    conceptSlug: "js.variable",
    title: "Şəhər adı",
    prompt: "city adlı const elan et.",
    instructions: "const və city sözləri lazımdır. Kod bu tapşırıqda icra olunmur.",
    type: "code_text",
    language: "javascript",
    difficulty: "easy",
    position: 2,
    starterCode: "const city = \"\";\n",
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["const", "city"],
        points: 100,
        feedback: "const city yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "js-type-string",
    lessonSlug: "js-values",
    conceptSlug: "js.value",
    title: "Mətn tipi",
    prompt: "\"10\" hansı tipdədir?",
    answer: "option-b",
    options: [
      ["option-a", "number"],
      ["option-b", "string"],
      ["option-c", "boolean"],
      ["option-d", "element"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  choiceExercise({
    slug: "js-type-boolean",
    lessonSlug: "js-values",
    conceptSlug: "js.value",
    title: "Boolean",
    prompt: "true hansı tipdədir?",
    answer: "option-c",
    options: [
      ["option-a", "string"],
      ["option-b", "number"],
      ["option-c", "boolean"],
      ["option-d", "array"],
    ],
    difficulty: "easy",
    position: 2,
  }),
  choiceExercise({
    slug: "js-condition-else",
    lessonSlug: "js-conditions",
    conceptSlug: "js.condition",
    title: "Else budağı",
    prompt: "if (score >= 60) şərti false olanda hansı budaq işləyir?",
    answer: "option-b",
    options: [
      ["option-a", "if blokunun içi"],
      ["option-b", "else bloku"],
      ["option-c", "hər ikisi"],
      ["option-d", "heç biri, dövr başlayır"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-condition-sign",
    lessonSlug: "js-conditions",
    conceptSlug: "js.condition",
    title: "Mənfi ədəd",
    prompt: "n mənfidirsə mənfi, əks halda müsbət mətnini seçən if yaz.",
    instructions: "if və else açar sözləri lazımdır.",
    type: "code_text",
    language: "javascript",
    difficulty: "intermediate",
    position: 2,
    starterCode: "function sign(n) {\n  \n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["if", "else"],
        points: 100,
        feedback: "if budağından sonra else yaz.",
      },
    ],
  },
  choiceExercise({
    slug: "js-loop-of",
    lessonSlug: "js-loops",
    conceptSlug: "js.loop",
    title: "Siyahını gəz",
    prompt: "Massivin hər elementi üçün bir dəfə işləyən konstruksiya hansıdır?",
    answer: "option-a",
    options: [
      ["option-a", "for...of dövrü"],
      ["option-b", "yalnız bir if"],
      ["option-c", "const"],
      ["option-d", "return"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-loop-write",
    lessonSlug: "js-loops",
    conceptSlug: "js.loop",
    title: "for...of",
    prompt: "items siyahısını gəzən for...of yaz.",
    instructions: "for və of sözləri lazımdır.",
    type: "code_text",
    language: "javascript",
    difficulty: "easy",
    position: 2,
    starterCode: "for (const item of items) {\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["for", "of", "items"],
        points: 100,
        feedback: "for (const item of items) formasını saxla.",
      },
    ],
  },
  choiceExercise({
    slug: "js-function-return",
    lessonSlug: "js-functions",
    conceptSlug: "js.function",
    title: "Nəticə",
    prompt: "Funksiyanın çağırana verdiyi dəyər harada yazılır?",
    answer: "option-c",
    options: [
      ["option-a", "selektorda"],
      ["option-b", "class atributunda"],
      ["option-c", "return-da"],
      ["option-d", "head-də"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-double",
    lessonSlug: "js-functions",
    conceptSlug: "js.function",
    title: "İkiqat",
    prompt: "double adlı funksiya bir ədədi qəbul edib onun ikiqatını qaytarsın.",
    instructions:
      "Funksiyanın adı double olmalıdır. Yoxlama serverdə, ayrı icra mühitində aparılır.",
    type: "code_text",
    language: "javascript",
    difficulty: "intermediate",
    position: 2,
    starterCode: "function double(n) {\n  return n;\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "execution_only",
        points: 100,
        feedback: "Funksiya serverdəki yoxlamalardan keçməlidir.",
      },
    ],
    execution: {
      entry: "double",
      tests: [
        { id: "double-a", args: [2], expected: 4, points: 34 },
        { id: "double-b", args: [0], expected: 0, points: 33 },
        { id: "double-c", args: [-3], expected: -6, points: 33 },
      ],
    },
  },
  choiceExercise({
    slug: "js-array-index",
    lessonSlug: "js-arrays",
    conceptSlug: "js.array",
    title: "İlk indeks",
    prompt: "Massivin birinci elementinin indeksi neçədir?",
    answer: "option-a",
    options: [
      ["option-a", "0"],
      ["option-b", "1"],
      ["option-c", "length"],
      ["option-d", "-1"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-array-first",
    lessonSlug: "js-arrays",
    conceptSlug: "js.array",
    title: "Birinci element",
    prompt: "first adlı funksiya massivin ilk elementini qaytarsın.",
    instructions: "Yoxlama serverdə aparılır.",
    type: "code_text",
    language: "javascript",
    difficulty: "advanced",
    position: 2,
    starterCode: "function first(items) {\n  return items;\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "execution_only",
        points: 100,
        feedback: "Funksiya serverdəki yoxlamalardan keçməlidir.",
      },
    ],
    execution: {
      entry: "first",
      tests: [
        { id: "first-a", args: [["HTML", "CSS"]], expected: "HTML", points: 50 },
        { id: "first-b", args: [[4, 9]], expected: 4, points: 50 },
      ],
    },
  },
  choiceExercise({
    slug: "js-object-key",
    lessonSlug: "js-objects",
    conceptSlug: "js.object",
    title: "Açar",
    prompt: "person.name ifadəsində name nədir?",
    answer: "option-b",
    options: [
      ["option-a", "İndeks"],
      ["option-b", "Açar"],
      ["option-c", "Selektor"],
      ["option-d", "Media query"],
    ],
    difficulty: "beginner",
    position: 1,
  }),
  {
    slug: "js-object-city",
    lessonSlug: "js-objects",
    conceptSlug: "js.object",
    title: "Şəhər sahəsi",
    prompt: "person.city açarını qaytaran city funksiyası yaz.",
    instructions: "Kod bu tapşırıqda icra olunmur. Server person.city ifadəsini axtarır.",
    type: "code_text",
    language: "javascript",
    difficulty: "advanced",
    position: 2,
    starterCode: "function city(person) {\n  return person;\n}\n",
    published: true,
    options: [],
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["function", "city", "person.city"],
        points: 100,
        feedback: "function city yaz və person.city qaytar.",
      },
    ],
  },
];
