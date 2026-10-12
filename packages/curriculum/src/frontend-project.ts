import type { ProjectFiles } from "@platform/types";
import type { ProjectSeed } from "@platform/validation";
import { taskflowProject } from "./taskflow-project";

const starterFiles: ProjectFiles = {
  "index.html": `<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
</head>
<body>
<script src="script.js"></script>
</body>
</html>
`,
  "style.css": "/* stillər */\n",
  "script.js": `function greet(name) {
  return "";
}
`,
};

const htmlConcepts = ["html.elements", "html.text", "html.links", "html.attributes"] as const;

export const frontendProjects: ProjectSeed[] = [
  {
    slug: "personal-portfolio",
    title: "Şəxsi Portfolio Səhifəsi",
    description:
      "Öyrəndiyiniz HTML ilə kiçik bir portfolio səhifəsi qurun. Hər mərhələ bir hissəni əlavə edir: quruluş, mətn, keçid, rəng, kart və sadə JavaScript.",
    objective:
      "Semantik HTML, keçid, sadə CSS və bir salamlama function-u olan səhifəni özünüz yazın.",
    difficulty: "beginner",
    estimatedMinutes: 40,
    status: "published",
    requiredConcepts: [...htmlConcepts],
    milestones: [
      milestone(1, "structure", "HTML quruluşu", "html.elements", {
        objective: "Səhifənin əsas hissələrini ayırın.",
        instructions:
          "index.html faylında header, main və bir h1 başlığı yazın. Başlıq səhifənin əsas başlığı olsun.",
        checks: [
          element("header", 34, "Header hissəsi", "Səhifədə header elementi görünmür."),
          element("main", 33, "Main hissəsi", "Səhifədə main elementi görünmür."),
          element("h1", 33, "Əsas başlıq", "Səhifədə h1 başlığı görünmür."),
        ],
      }),
      milestone(2, "links", "Məzmun və keçid", "html.links", {
        objective: "Başlığa ad verin və xarici keçid əlavə edin.",
        instructions:
          "Əsas başlığa Portfolio sözünü yazın. https://example.com ünvanına aparan bir keçid əlavə edin.",
        checks: [
          {
            type: "contains_text",
            file: "index.html",
            text: "Portfolio",
            points: 34,
            label: "Portfolio mətni",
            feedback: "Başlıqda Portfolio sözü görünmür.",
          },
          element("a", 33, "Keçid", "Səhifədə keçid elementi görünmür."),
          {
            type: "html_attribute_equals",
            tag: "a",
            attribute: "href",
            value: "https://example.com",
            points: 33,
            label: "Keçid ünvanı",
            feedback: "Keçid gözlənilən ünvana aparmır.",
          },
        ],
      }),
      milestone(3, "style", "Rəng və boşluq", "web.css", {
        objective: "Səhifəyə sadə rəng və boşluq verin.",
        instructions:
          "style.css faylında body üçün color və h1 üçün margin yazın. Fayl index.html ilə artıq əlaqələndirilib.",
        checks: [
          declaration("body", "color", 50, "Mətn rəngi", "body üçün color yazılmayıb."),
          declaration("h1", "margin", 50, "Başlıq boşluğu", "h1 üçün margin yazılmayıb."),
        ],
      }),
      milestone(4, "cards", "Kart düzülüşü", "web.css", {
        objective: "Bir kart bloku yaradın.",
        instructions:
          'index.html içində bir section elementinə class="card" verin. style.css içində .card üçün padding yazın.',
        checks: [
          {
            type: "html_attribute_equals",
            tag: "section",
            attribute: "class",
            value: "card",
            points: 50,
            label: "Kart elementi",
            feedback: "section elementində card sinfi görünmür.",
          },
          declaration(".card", "padding", 50, "Kart boşluğu", ".card üçün padding yazılmayıb."),
        ],
      }),
      milestone(5, "greeting", "Salamlama", "web.javascript", {
        objective: "Ad qəbul edən kiçik bir function yazın.",
        instructions:
          "script.js faylında greet function-u name qəbul etsin və Salam, ilə başlayan mətni qaytarsın. Məsələn, ad Aysel olanda nəticə Salam, Aysel olsun.",
        checks: [
          {
            type: "javascript_call",
            entry: "greet",
            label: "Salamlama funksiyası",
            feedback: "Salamlama funksiyası gözlənilən nəticəni qaytarmır.",
            tests: [
              {
                id: "greet-a",
                args: ["Aysel"],
                expected: "Salam, Aysel",
                points: 50,
              },
              {
                id: "greet-b",
                args: ["Qx7"],
                expected: "Salam, Qx7",
                points: 50,
              },
            ],
          },
        ],
      }),
      milestone(6, "polish", "Son düzəliş", "web.html", {
        objective: "Səhifəni tamamlamaq üçün başlıq, alt hissə və stil əlaqəsini yoxlayın.",
        instructions:
          "head içində title elementi yazın, səhifəyə footer əlavə edin və style.css faylına aparan link-in qaldığını yoxlayın.",
        checks: [
          element("title", 34, "Səhifə başlığı", "title elementi görünmür."),
          element("footer", 33, "Alt hissə", "footer elementi görünmür."),
          {
            type: "html_attribute_equals",
            tag: "link",
            attribute: "rel",
            value: "stylesheet",
            points: 33,
            label: "Stil əlaqəsi",
            feedback: "style.css faylına aparan link görünmür.",
          },
        ],
      }),
    ],
  },
  taskflowProject,
  {
    slug: "portfolio-hidden",
    title: "Gizli portfolio",
    description: "Bu layihə dərc olunmayıb.",
    objective: "Dərc olunmamış layihə əlçatan deyil.",
    difficulty: "beginner",
    estimatedMinutes: 20,
    status: "draft",
    requiredConcepts: [...htmlConcepts],
    milestones: [
      milestone(1, "structure", "HTML quruluşu", "html.elements", {
        objective: "Dərc olunmayıb.",
        instructions: "Bu mərhələ dərc olunmayıb.",
        checks: [element("header", 100, "Header", "Header görünmür.")],
      }),
    ],
  },
];

function milestone(
  position: number,
  slug: string,
  title: string,
  conceptSlug: string,
  input: {
    objective: string;
    instructions: string;
    checks: ProjectSeed["milestones"][number]["checks"];
  },
): ProjectSeed["milestones"][number] {
  return {
    slug,
    position,
    title,
    conceptSlug,
    objective: input.objective,
    instructions: input.instructions,
    starterFiles,
    checks: input.checks,
  };
}

function element(
  tag: string,
  points: number,
  label: string,
  feedback: string,
): ProjectSeed["milestones"][number]["checks"][number] {
  return { type: "html_element_exists", tag, points, label, feedback };
}

function declaration(
  selector: string,
  property: string,
  points: number,
  label: string,
  feedback: string,
): ProjectSeed["milestones"][number]["checks"][number] {
  return { type: "css_declaration", selector, property, points, label, feedback };
}
