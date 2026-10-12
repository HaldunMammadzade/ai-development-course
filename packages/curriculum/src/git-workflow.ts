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

/** Optional practice module. It is not a second path and it does not run Git. */
export const GIT_MODULE_SLUG = "git";

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
  minutes: number;
  primary: string[];
  paragraphs: string[];
  question: string;
  rubric: string[];
  points: string[];
  practice: string;
}): LessonDefinition {
  const concepts = input.primary.map((conceptSlug) => ({
    conceptSlug,
    role: "primary" as const,
  }));
  const blocks: LessonBlock[] = [
    reading(1, input.paragraphs.join("\n\n"), input.primary),
    check(2, input.question, input.rubric, [input.primary[0] ?? "git.repository"]),
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

const noGit =
  "Bu mətn yoxlamasıdır. Server Git əmri işlətmir, fayl sisteminə toxunmur və GitHub-a bağlanmır.";

function choice(input: {
  slug: string;
  lessonSlug: string;
  conceptSlug: string;
  title: string;
  prompt: string;
  answer: string;
  options: Array<[string, string]>;
  position: number;
}): ExerciseDefinition {
  return {
    slug: input.slug,
    lessonSlug: input.lessonSlug,
    conceptSlug: input.conceptSlug,
    title: input.title,
    prompt: input.prompt,
    instructions: `Bir variant seç. ${noGit}`,
    type: "multiple_choice",
    language: null,
    difficulty: "beginner",
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

function text(input: {
  slug: string;
  lessonSlug: string;
  conceptSlug: string;
  title: string;
  prompt: string;
  instructions: string;
  position: number;
  starterCode?: string;
  rules: ExerciseDefinition["rules"];
}): ExerciseDefinition {
  return {
    slug: input.slug,
    lessonSlug: input.lessonSlug,
    conceptSlug: input.conceptSlug,
    title: input.title,
    prompt: input.prompt,
    instructions: `${input.instructions} ${noGit}`,
    type: "code_text",
    language: null,
    difficulty: "beginner",
    position: input.position,
    starterCode: input.starterCode ?? null,
    published: true,
    options: [],
    rules: input.rules,
  };
}

export const gitConcepts: ConceptDefinition[] = [
  {
    slug: "git.repository",
    name: "Repository",
    domain: "git",
    summary: "Repository layihənin izlənilən tarixçəsini saxlayan qovluqdur.",
  },
  {
    slug: "git.working-tree",
    name: "Working tree",
    domain: "git",
    summary:
      "Working tree hazırda diskdə gördüyün fayllardır. Hər dəyişiklik hələ tarixçəyə düşmür.",
  },
  {
    slug: "git.diff",
    name: "Diff",
    domain: "git",
    summary: "Diff iki vəziyyət arasındakı fərqi göstərir ki, nəyi saxladığını görə biləsən.",
  },
  {
    slug: "git.stage",
    name: "Staging",
    domain: "git",
    summary: "Staging növbəti commit-ə hansı dəyişikliklərin düşəcəyini seçməyə imkan verir.",
  },
  {
    slug: "git.commit",
    name: "Commit",
    domain: "git",
    summary: "Commit seçilmiş dəyişikliklərin mənalı bir qeydlə saxlanmış anıdır.",
  },
  {
    slug: "git.history",
    name: "History",
    domain: "git",
    summary: "History commit-lərin ardıcıllığıdır. Layihənin necə böyüdüyünü buradan oxuyursan.",
  },
  {
    slug: "git.branch",
    name: "Branch",
    domain: "git",
    summary:
      "Branch eyni layihədə ayrıca bir iş xəttidir. Əsas xətti pozmadan dəyişiklik yoxlanır.",
  },
  {
    slug: "git.merge",
    name: "Merge",
    domain: "git",
    summary: "Merge bitmiş iş xəttini əsas xəttə qaytarır.",
  },
  {
    slug: "git.conflict",
    name: "Merge conflict",
    domain: "git",
    summary: "Conflict eyni sətri iki xətt fərqli dəyişəndə yaranır. Nəticəni insan seçir.",
  },
  {
    slug: "git.remote",
    name: "Remote",
    domain: "git",
    summary:
      "Remote, adətən origin, layihənin başqa bir nüsxəsidir. Push göndərir, fetch gətirir, pull gətirib birləşdirir.",
  },
  {
    slug: "git.pull-request",
    name: "Pull request",
    domain: "git",
    summary:
      "Pull request dəyişikliyi birləşdirməzdən əvvəl məqsədini və fərqini müzakirə etmək üçündür.",
  },
  {
    slug: "git.review",
    name: "Code review",
    domain: "git",
    summary: "Review başqasının dəyişikliyə baxıb sual, düzəliş və ya razılıq bildirməsidir.",
  },
];

export const gitPrerequisites: ConceptPrerequisite[] = [
  { conceptSlug: "git.working-tree", prerequisiteSlug: "git.repository" },
  { conceptSlug: "git.diff", prerequisiteSlug: "git.repository" },
  { conceptSlug: "git.stage", prerequisiteSlug: "git.diff" },
  { conceptSlug: "git.commit", prerequisiteSlug: "git.stage" },
  { conceptSlug: "git.history", prerequisiteSlug: "git.commit" },
  { conceptSlug: "git.branch", prerequisiteSlug: "git.history" },
  { conceptSlug: "git.merge", prerequisiteSlug: "git.branch" },
  { conceptSlug: "git.conflict", prerequisiteSlug: "git.merge" },
  { conceptSlug: "git.remote", prerequisiteSlug: "git.merge" },
  { conceptSlug: "git.pull-request", prerequisiteSlug: "git.remote" },
  { conceptSlug: "git.review", prerequisiteSlug: "git.pull-request" },
];

export const gitLessons: LessonDefinition[] = [
  lesson({
    slug: "git-repository",
    title: "Repository və iş ağacı",
    objective: "Layihənin izlənilən tarixçəsini diskdəki cari fayllardan ayırd etmək.",
    position: 1,
    minutes: 15,
    primary: ["git.repository", "git.working-tree"],
    paragraphs: [
      "TaskFlow kimi bir layihə əvvəlcə sadəcə fayllardır. Git repository həmin layihənin dəyişiklik tarixçəsini saxlayan yerdir. Working tree isə hazırda qovluqda gördüyün fayllardır.",
      "Faylı redaktə etmək onu hələ tarixçəyə yazmır. Repository yalnız sən commit ilə saxladığın anları bilir. İzlənilən fayl artıq repository-nin diqqətində olan fayldır.",
      "Bu fərq ona görə var ki, hər yarımcıq cəhd tarixçəyə düşməsin. Əvvəl nəyin layihənin bir hissəsi olduğunu, nəyin isə hələ yalnız sənin ekranında olduğunu görürsən.",
    ],
    question: "Working tree ilə repository arasındakı fərq nədir?",
    rubric: [
      "Working tree diskdəki cari fayllardır",
      "Repository saxlanmış tarixçədir",
      "Redaktə özü commit deyil",
    ],
    points: [
      "Repository tarixçəni saxlayır.",
      "Working tree cari fayllardır.",
      "Hər dəyişiklik avtomatik tarixçəyə düşmür.",
    ],
    practice:
      "TaskFlow qovluğunda hansı faylın izləndiyini, hansının isə hələ yalnız iş ağacında olduğunu de.",
  }),
  lesson({
    slug: "git-changes",
    title: "Fərq və seçim",
    objective: "Dəyişikliyi görmək və commit-ə yalnız nəzərdə tutulan hissəni seçmək.",
    position: 2,
    minutes: 15,
    primary: ["git.diff", "git.stage"],
    paragraphs: [
      "Diff iki vəziyyətin fərqidir. TaskFlow-da filtr əlavə edəndə diff sənə hansı sətrin gəldiyini göstərir. Beləcə başqa bir işin təsadüfən eyni qeydə düşməsinin qarşısını alırsan.",
      "Staging area növbəti commit-in məzmunudur. Working tree-də bir neçə fayl dəyişə bilər. Commit-ə yalnız hazır olanı, məsələn src/components/TaskForm.tsx faylını, əlavə edirsən.",
      "Bu addım ona görə var ki, bir commit bir məqsəd daşısın. Filtr dəyişikliyi ilə əlaqəsiz bir düzəlişi eyni qeydə qarışdırmaq tarixçəni oxunmaz edir.",
    ],
    question: "Niyə bütün dəyişiklikləri bir dəfəyə commit etmək həmişə düzgün deyil?",
    rubric: [
      "Diff nəyin dəyişdiyini göstərir",
      "Staging yalnız seçilmiş hissəni götürür",
      "Bir commit bir məqsəd daşımalıdır",
    ],
    points: [
      "Əvvəl fərqə bax.",
      "Sonra yalnız hazır faylı seç.",
      "Qalan dəyişiklik working tree-də qala bilər.",
    ],
    practice: "Yalnız TaskForm dəyişikliyini seç. Siyahı faylını bu commit-ə qatma.",
  }),
  lesson({
    slug: "git-commits",
    title: "Commit və tarixçə",
    objective: "Seçilmiş dəyişikliyi oxuna bilən bir mesajla saxlamaq və tarixçədən oxumaq.",
    position: 3,
    minutes: 15,
    primary: ["git.commit", "git.history"],
    paragraphs: [
      "Commit staging-dəki dəyişikliyin adıdır. Mesaj gələcək oxucuya, çox vaxt sabahkı sənə, nəyin niyə edildiyini deyir. update heç nə demir. Add task filtering isə filtrin əlavə olunduğunu deyir.",
      "Yaxşı mesaj əmr formasındadır və bir işi adlandırır. Bir neçə əlaqəsiz işi bir mesajın içinə yığmaq tarixçəni qarışdırır.",
      "History bu qeydlərin ardıcıllığıdır. TaskFlow-da əvvəl siyahı, sonra forma, sonra filtr görünürsə, layihənin necə böyüdüyünü commit-ləri oxuyaraq başa düşürsən.",
    ],
    question: "Commit mesajı nəyə xidmət edir?",
    rubric: [
      "Mesaj dəyişikliyin məqsədini deyir",
      "update kimi boş söz kifayət deyil",
      "History qeydlərin ardıcıllığıdır",
    ],
    points: [
      "Bir commit, bir məqsəd.",
      "Mesaj əmr formasında olsun.",
      "Tarixçə layihənin böyüməsini göstərir.",
    ],
    practice: "Filtr dəyişikliyi üçün Add task filtering mesajını yaz.",
  }),
  lesson({
    slug: "git-branches",
    title: "Branch və birləşdirmə",
    objective: "Əsas xətti saxlayaraq ayrıca iş xətti açmaq və hazır olanda geri qaytarmaq.",
    position: 4,
    minutes: 18,
    primary: ["git.branch", "git.merge"],
    paragraphs: [
      "Branch eyni repository içində ayrıca bir xətdir. TaskFlow-nun əsas xətti main qalır. Filtr işini feature/task-filter üzərində aparırsan ki, yarımçıq iş əsas xəttə düşməsin.",
      "Switch və ya checkout həmin xəttə keçməkdir. İş bitəndə merge onu main ilə birləşdirir. Merge yeni bir fikir deyil. Artıq yoxlanmış işi ümumi xəttə qaytarır.",
      "Bu axın ona görə var ki, bir nəfər filtr, başqası forma üzərində işləyə bilsin. Əsas xətt isə hər yarımçıq cəhdi daşımasın.",
    ],
    question: "Feature branch nəyi qoruyur?",
    rubric: [
      "Əsas xətt yarımçıq işdən ayrı qalır",
      "İş bitəndə merge onu geri qaytarır",
      "Branch ayrıca tarixçə xəttidir",
    ],
    points: [
      "İşi feature/task-filter üzərində apar.",
      "Əsas xətti yarımçıq saxlama.",
      "Hazır olanda birləşdir.",
    ],
    practice: "Filtr üçün feature/task-filter xəttinin adını yaz.",
  }),
  lesson({
    slug: "git-conflicts",
    title: "Birləşmə ziddiyyəti",
    objective: "Eyni sətir iki xətdə fərqli dəyişəndə nəticəni özün seçmək.",
    position: 5,
    minutes: 15,
    primary: ["git.conflict"],
    paragraphs: [
      'Merge conflict Git qərar verə bilməyəndə yaranır. Bir xətdə const title = "TaskFlow", o biri xətdə const title = "Task Manager" varsa, eyni sətir iki cür dəyişib.',
      "Faylda <<<<<<<, ======= və >>>>>>> işarələri iki tərəfi ayırır. HEAD cari xətdir, digər hissə gələn xətdir. Bu işarələr proqramın bir hissəsi deyil. Onları silib qalmasını istədiyin kodu saxlayırsan.",
      "TaskFlow-nun adı TaskFlow qalmalıdır. Conflict-i görməzdən gəlmək və ya hər iki sətri birlikdə saxlamaq səhifəni sınmış vəziyyətdə buraxır.",
    ],
    question: "Conflict işarələri nəyi bildirir?",
    rubric: [
      "Eyni yer iki xətdə fərqli dəyişib",
      "HEAD cari xəttdir",
      "İşarələr son kodda qalmamalıdır",
    ],
    points: [
      "Cari dəyişikliklə gələn dəyişikliyi ayır.",
      "İşarələri sil.",
      "Layihənin adı TaskFlow qalsın.",
    ],
    practice: 'Conflict-i elə həll et ki, qalan sətir const title = "TaskFlow" olsun.',
  }),
  lesson({
    slug: "git-remote",
    title: "Uzaq nüsxə",
    objective: "Öz nüsxən ilə origin arasındakı göndərmə və gətirməni ayırd etmək.",
    position: 6,
    minutes: 15,
    primary: ["git.remote"],
    paragraphs: [
      "Remote başqa bir yerdə duran nüsxədir. origin adətən komandanın ortaq nüsxəsinin qısa adıdır. Sənin kompüterindəki repository ilə origin eyni layihədir, eyni an deyil.",
      "Push sənin commit-ini origin-ə göndərir. Fetch origin-dəki yeniliyi gətirir, amma sənin cari xəttinə qarışdırmır. Pull gətirir və cari xəttə birləşdirir.",
      "Bu fərq ona görə vacibdir ki, başqasının işini görmədən öz işinin üstünə yazmaya sənin qərarın olsun. Heç bir parol və ya token bu addımda saxlanılmır. Bu dərs real GitHub əməliyyatı etmir.",
    ],
    question: "Fetch ilə pull arasındakı fərq nədir?",
    rubric: [
      "Fetch gətirir, birləşdirmir",
      "Pull gətirib cari xəttə birləşdirir",
      "Push yerli commit-i origin-ə göndərir",
    ],
    points: ["origin ortaq nüsxənin adıdır.", "Push göndərir.", "Fetch və pull eyni iş deyil."],
    practice: "Pull-un nə etdiyini fetch-dən ayır.",
  }),
  lesson({
    slug: "git-pull-request",
    title: "Pull request və review",
    objective: "Dəyişikliyi birləşdirməzdən əvvəl məqsədini yazmaq və rəyə cavab vermək.",
    position: 7,
    minutes: 18,
    primary: ["git.pull-request", "git.review"],
    paragraphs: [
      "Pull request origin-də bir xəttin digərinə birləşdirilməsini təklif edir. İçində başlıq, nəyin niyə dəyişdiyi, dəyişən fayllar və review olur. TaskFlow filtrini feature/task-filter xəttindən main-ə bu söhbət ilə gətirirsən.",
      "Review başqasının kodu oxuyub konkret yer haqqında danışmasıdır. Rəy üç cür bitə bilər: dəyişiklik istənilir, sual açıq qalır, ya da iş qəbul olunur. Qəbul merge üçün razılıqdır, özü merge deyil.",
      "Məsələn rəyçi filtrin state-ini parent component-də saxlamağı təklif edə bilər ki, digər filtrlərlə əlaqə aydın olsun. Sən kodu dəyişə, qərarını izah edə və ya dəqiqləşdirmə istəyə bilərsən. Bu dərs real pull request açmır.",
    ],
    question: "Pull request nəyi birləşdirməzdən əvvəl görünən edir?",
    rubric: [
      "Məqsəd və dəyişən fayllar görünür",
      "Review razılıqdan əvvəl danışıqdır",
      "Merge təklif qəbul olunandan sonra gəlir",
    ],
    points: ["Başlıq və səbəb yaz.", "Rəyə konkret cavab ver.", "Birləşdirmə ayrıca addımdır."],
    practice: "Filtr dəyişikliyi üçün başlıq və state-in harada qalacağına qərar yaz.",
  }),
];

export const gitExercises: ExerciseDefinition[] = [
  choice({
    slug: "git-repository-identify",
    lessonSlug: "git-repository",
    conceptSlug: "git.repository",
    title: "Nə repository-dir",
    prompt: "TaskFlow qovluğunda hansı ifadə repository-ni təsvir edir?",
    answer: "history",
    position: 1,
    options: [
      ["history", "Layihənin saxlanmış dəyişiklik tarixçəsi"],
      ["editor", "Hazırda açıq olan redaktor pəncərəsi"],
      ["password", "GitHub parolu"],
      ["deploy", "Saytın canlı ünvanı"],
    ],
  }),
  choice({
    slug: "git-working-tree-identify",
    lessonSlug: "git-repository",
    conceptSlug: "git.working-tree",
    title: "Nə working tree-dir",
    prompt: "Working tree hansıdır?",
    answer: "files",
    position: 2,
    options: [
      ["files", "Hazırda qovluqda gördüyün fayllar"],
      ["history", "Artıq saxlanmış commit tarixçəsi"],
      ["remote", "Origin adlanan uzaq nüsxə"],
      ["token", "GitHub tokeni"],
    ],
  }),
  text({
    slug: "git-diff-line",
    lessonSlug: "git-changes",
    conceptSlug: "git.diff",
    title: "Nə dəyişdi",
    prompt:
      "Əvvəl sətir const visible = tasks; idi. İndi const visible = tasks.filter((task) => task.status === status); oldu. Əlavə olunan sətri yaz.",
    instructions: "Yalnız yeni sətri yaz.",
    position: 1,
    rules: [
      {
        type: "contains_text",
        text: "const visible = tasks.filter((task) => task.status === status);",
        points: 100,
        feedback: "Diff-də görünən yeni sətri olduğu kimi yaz.",
      },
    ],
  }),
  text({
    slug: "git-stage-task-form",
    lessonSlug: "git-changes",
    conceptSlug: "git.stage",
    title: "Yalnız hazır fayl",
    prompt:
      "Working tree-də src/components/TaskForm.tsx və src/components/TaskList.tsx dəyişib. Commit-ə yalnız forma faylını seç.",
    instructions: "Yalnız stage etmək istədiyin faylın yolunu yaz.",
    position: 2,
    rules: [
      {
        type: "exact_text",
        text: "src/components/TaskForm.tsx",
        points: 100,
        feedback:
          "Yalnız src/components/TaskForm.tsx seçilməlidir. Siyahı faylı bu commit-ə düşmür.",
      },
    ],
  }),
  text({
    slug: "git-commit-message",
    lessonSlug: "git-commits",
    conceptSlug: "git.commit",
    title: "Commit mesajı",
    prompt: "TaskFlow-ya status filtri əlavə edən commit üçün mesaj yaz.",
    instructions: "Əmr formasında, bir işi adlandıran mesaj yaz. update kifayət deyil.",
    position: 1,
    rules: [
      {
        type: "regex",
        pattern: "^(Add|Fix|Remove|Rename) ",
        points: 50,
        feedback: "Mesaj Add, Fix, Remove və ya Rename ilə başlasın.",
      },
      {
        type: "contains_text",
        text: "task filtering",
        points: 50,
        feedback: "Mesaj filtr işini adlandırmalıdır: task filtering.",
      },
    ],
  }),
  text({
    slug: "git-history-order",
    lessonSlug: "git-commits",
    conceptSlug: "git.history",
    title: "Tarixçənin ardıcıllığı",
    prompt:
      "TaskFlow commit-lərini əvvəldən sona yaz: Create task list, Add task form, Add task filtering.",
    instructions: "Üç başlığı bu ardıcıllıqla yaz.",
    position: 2,
    rules: [
      {
        type: "ordered_tokens",
        tokens: ["Create task list", "Add task form", "Add task filtering"],
        points: 100,
        feedback: "Əvvəl siyahı, sonra forma, sonra filtr.",
      },
    ],
  }),
  text({
    slug: "git-feature-branch",
    lessonSlug: "git-branches",
    conceptSlug: "git.branch",
    title: "Feature branch",
    prompt: "Status filtri üçün əsas xətdən ayrı iş xəttinin adını yaz.",
    instructions: "Dərsdəki branch adını yaz.",
    position: 1,
    rules: [
      {
        type: "exact_text",
        text: "feature/task-filter",
        points: 100,
        feedback: "İş xəttinin adı feature/task-filter-dir.",
      },
    ],
  }),
  choice({
    slug: "git-merge-feature",
    lessonSlug: "git-branches",
    conceptSlug: "git.merge",
    title: "Nəyi birləşdirirsən",
    prompt: "Filtr işi bitəndə merge nə edir?",
    answer: "merge-feature",
    position: 2,
    options: [
      ["merge-feature", "feature/task-filter xəttini main ilə birləşdirir"],
      ["delete-main", "main xəttini silir"],
      ["send-password", "GitHub parolunu origin-ə göndərir"],
      ["skip-history", "Köhnə commit-ləri tarixçədən çıxarır"],
    ],
  }),
  text({
    slug: "git-conflict-title",
    lessonSlug: "git-conflicts",
    conceptSlug: "git.conflict",
    title: "Conflict-i həll et",
    prompt:
      'HEAD const title = "TaskFlow" saxlayır. Gələn xətt const title = "Task Manager" yazır. Layihənin adı TaskFlow qalmalıdır. Son kodu yaz.',
    instructions: "Conflict işarələrini sil. Qalan bir sətir olsun.",
    position: 1,
    starterCode: [
      "<<<<<<< HEAD",
      'const title = "TaskFlow";',
      "=======",
      'const title = "Task Manager";',
      ">>>>>>> feature/rename",
    ].join("\n"),
    rules: [
      {
        type: "exact_text",
        text: 'const title = "TaskFlow";',
        points: 100,
        feedback: 'İşarələri və gələn adı sil. Qalan sətir const title = "TaskFlow"; olmalıdır.',
      },
    ],
  }),
  choice({
    slug: "git-remote-pull",
    lessonSlug: "git-remote",
    conceptSlug: "git.remote",
    title: "Pull nə edir",
    prompt: "Pull origin ilə sənin cari xəttin arasında nə edir?",
    answer: "pull-integrates",
    position: 1,
    options: [
      ["pull-integrates", "Uzaq dəyişikliyi gətirir və cari xəttə birləşdirir"],
      ["fetch-only", "Uzaq dəyişikliyi gətirir, cari xəttə birləşdirmir"],
      ["push-only", "Sənin commit-ini origin-ə göndərir"],
      ["store-token", "GitHub tokenini brauzerdə saxlayır"],
    ],
  }),
  text({
    slug: "git-pr-summary",
    lessonSlug: "git-pull-request",
    conceptSlug: "git.pull-request",
    title: "Pull request",
    prompt:
      "feature/task-filter xəttini main-ə təklif et. Başlıq və səbəb yaz: statusa görə filtr.",
    instructions: "Başlıqda işin adını, mətnində status sözünü saxla.",
    position: 1,
    rules: [
      {
        type: "contains_text",
        text: "Add task filtering",
        points: 50,
        feedback: "Başlıq Add task filtering olsun.",
      },
      {
        type: "contains_text",
        text: "status",
        points: 50,
        feedback: "Səbəbdə status filtrini de.",
      },
    ],
  }),
  text({
    slug: "git-review-response",
    lessonSlug: "git-pull-request",
    conceptSlug: "git.review",
    title: "Rəyə cavab",
    prompt:
      "Rəyçi deyir: filtrin state-i parent component-də qalsa, digər filtrlərlə əlaqə daha aydın olar. Kodu dəyişmək qərarını bir cümlə ilə yaz.",
    instructions: "State-in harada qalacağını de.",
    position: 2,
    rules: [
      {
        type: "regex",
        pattern: "parent|valideyn",
        points: 100,
        feedback: "Cavabda state-in parent component-də qalacağını de.",
      },
    ],
  }),
];
