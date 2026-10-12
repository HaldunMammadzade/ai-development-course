export interface SpeakingQuestionSeed {
  slug: string;
  title: string;
  prompt: string;
  conceptSlug: string;
  position: number;
  published: boolean;
}

export const SPEAKING_TITLE = "Danışıq məşqi";

export const frontendSpeakingQuestions: readonly SpeakingQuestionSeed[] = [
  {
    slug: "semantic-html",
    title: "Semantik HTML",
    prompt: "HTML-də semantic element nədir və niyə istifadə olunur?",
    conceptSlug: "html.elements",
    position: 1,
    published: true,
  },
  {
    slug: "html-element",
    title: "HTML element",
    prompt: "HTML elementin açılış və bağlanış hissəsi nə deməkdir?",
    conceptSlug: "html.elements",
    position: 2,
    published: true,
  },
  {
    slug: "html-text",
    title: "Mətn",
    prompt: "Səhifədə görünən mətni HTML-də necə yazırıq?",
    conceptSlug: "html.text",
    position: 3,
    published: true,
  },
  {
    slug: "html-link",
    title: "Keçid",
    prompt: "Link istifadəçini hara aparır?",
    conceptSlug: "html.links",
    position: 4,
    published: true,
  },
  {
    slug: "html-attribute",
    title: "Atribut",
    prompt: "HTML atributu elementə nə əlavə edir?",
    conceptSlug: "html.attributes",
    position: 5,
    published: true,
  },
  {
    slug: "css-rule",
    title: "CSS",
    prompt: "CSS qaydası səhifənin görünüşünü necə dəyişir?",
    conceptSlug: "web.css",
    position: 6,
    published: true,
  },
  {
    slug: "browser",
    title: "Brauzer",
    prompt: "Brauzer HTML-i ekranda necə göstərir?",
    conceptSlug: "web.browser",
    position: 7,
    published: true,
  },
  {
    slug: "url",
    title: "URL",
    prompt: "URL hansı səhifəni göstərdiyini necə bildirir?",
    conceptSlug: "web.url",
    position: 8,
    published: true,
  },
  {
    slug: "http",
    title: "HTTP",
    prompt: "Brauzer səhifəni serverdən necə istəyir?",
    conceptSlug: "web.http",
    position: 9,
    published: true,
  },
  {
    slug: "javascript",
    title: "JavaScript",
    prompt: "JavaScript səhifədə nəyi dəyişə bilər?",
    conceptSlug: "web.javascript",
    position: 10,
    published: true,
  },
  {
    slug: "debugging",
    title: "Səhv",
    prompt: "Səhifədə bir şey işləməyəndə ilk olaraq nəyə baxırsınız?",
    conceptSlug: "web.javascript",
    position: 11,
    published: true,
  },
  {
    slug: "http-response",
    title: "Sorğu və cavab",
    prompt: "HTTP sorğusu ilə HTTP cavabı arasındakı fərq nədir?",
    conceptSlug: "web.http",
    position: 12,
    published: true,
  },
  {
    slug: "unpublished-speaking",
    title: "Gizli danışıq",
    prompt: "Bu sual tələbəyə görünməməlidir.",
    conceptSlug: "html.elements",
    position: 201,
    published: false,
  },
];
