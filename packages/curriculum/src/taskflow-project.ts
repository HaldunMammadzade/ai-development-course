import type { ProjectFiles } from "@platform/types";
import type { ProjectSeed } from "@platform/validation";

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
  "script.js": "// TaskFlow mənbəyi\n",
};

const concepts = [
  "next.app-router",
  "ts.interface",
  "react.list",
  "react.form",
  "react.effect",
  "next.data-fetching",
  "next.dynamic-route",
  "html.a11y",
] as const;

export const taskflowProject: ProjectSeed = {
  slug: "taskflow",
  title: "TaskFlow — Real-World Task Management App",
  description:
    "HTML, CSS, JavaScript, TypeScript, React və Next.js biliklərini bir tapşırıq tətbiqində birləşdirin. Server hazır məlumatı yoxlayır. Xarici backend, paket quraşdırma və Next.js prosesi bu mərhələdə yoxdur.",
  objective:
    "Dashboard, siyahı, forma, axtarış, status, yüklənmə və dinamik tapşırıq səhifəsi olan responsiv interfeys yazın.",
  difficulty: "intermediate",
  estimatedMinutes: 180,
  status: "published",
  requiredConcepts: [...concepts],
  milestones: [
    step(1, "foundation", "Layihə əsası", "next.app-router", {
      objective: "Semantik səhifə, flex əsası və kök layout olsun.",
      instructions:
        "index.html içində header və main yazın. style.css içində main selektoruna display verin. script.js içində function RootLayout yazın. Next.js prosesi işə düşmür: layout mənbəyini bu faylda saxlayın.",
      checks: [
        element("header", 34, "Başlıq zolağı", "Səhifədə header elementi görünmür."),
        declaration("main", "display", 33, "Əsas ox", "main qutusu üçün display yazın."),
        text("script.js", "function RootLayout", 33, "Kök layout", "Kök layout funksiyası görünmür."),
      ],
    }),
    step(2, "components", "Task modeli və komponentlər", "ts.interface", {
      objective: "Tapşırıq tipi və iki ayrı komponent olsun.",
      instructions:
        "script.js içində interface Task yazın. id, title və status sahələri olsun. function StatusBadge və function TaskCard ayrı olsun. TaskCard tapşırığı props ilə qəbul etsin.",
      checks: [
        text("script.js", "interface Task", 34, "Task tipi", "Task üçün interface görünmür."),
        text("script.js", "function TaskCard", 33, "Kart", "TaskCard funksiyası görünmür."),
        text("script.js", "function StatusBadge", 33, "Status nişanı", "StatusBadge funksiyası görünmür."),
      ],
    }),
    step(3, "task-list", "Tapşırıq siyahısı", "react.list", {
      objective: "Massiv render olunsun və açar stabil olsun.",
      instructions:
        "tasks massivini map ilə çevirin. Element parametri task olsun və açarı onun id sahəsi olsun. Sıra nömrəsini açar kimi yazmayın. Siyahı boşdursa qısa boş vəziyyət mətni göstərin.",
      checks: [
        text("script.js", "tasks.map", 34, "Siyahı", "Tapşırıq massivi map ilə render olunmur."),
        text("script.js", "key={task.id}", 33, "Stabil açar", "Siyahı açarı tapşırığın id sahəsi deyil."),
        absent("script.js", "key={index}", 33, "İndeks açarı yoxdur", "Siyahı açarı sıra nömrəsi olmamalıdır."),
      ],
    }),
    step(4, "task-form", "Yaratma və redaktə", "react.form", {
      objective: "Başlıq boşdursa tapşırıq yaranmasın.",
      instructions:
        "index.html içində form və başlıq üçün label yazın. Labelin for atributu title olsun. script.js içində başlığı trim ilə yoxlayın. Seçilmiş tapşırığı yeniləyən idarə olunan formanı özünüz qurun.",
      checks: [
        element("form", 34, "Forma", "Səhifədə form elementi görünmür."),
        attribute("label", "for", "title", 33, "Etiket", "Başlıq sahəsinin etiketi title ilə bağlanmır."),
        text("script.js", "trim()", 33, "Boş başlıq", "Boş başlıq yoxlanılmır."),
      ],
    }),
    step(5, "search-filter", "Axtarış və filtr", "react.effect", {
      objective: "Filtrlənmiş siyahı render zamanı hesablandı.",
      instructions:
        "Axtarış mətnini search adlı state-də saxlayın. Görünən siyahını filter ilə render zamanı hesablayın. Bu mərhələdə effekt yazmayın: filtr nəticəsini effektin içinə qoymayın.",
      checks: [
        text("script.js", "filter(", 34, "Filtr", "Siyahı filter ilə daralmır."),
        text("script.js", "search", 33, "Axtarış", "Axtarış mətni görünmür."),
        absent("script.js", "useEffect", 33, "Törəmə state", "Filtr nəticəsini effektin içində saxlamayın."),
      ],
    }),
    step(6, "api-data", "Məlumat və vəziyyətlər", "next.data-fetching", {
      objective: "Məlumat, yüklənmə və xəta ayrı olsun.",
      instructions:
        "async function loadTasks yazın və hazır tapşırıq massivi qaytarın. Xarici server lazım deyil. loading vəziyyətini saxlayın, xətanı catch ilə tutun və eyni funksiyanı yenidən çağırmağa imkan verin.",
      checks: [
        text("script.js", "async function loadTasks", 34, "Yükləmə funksiyası", "loadTasks funksiyası görünmür."),
        text("script.js", "loading", 33, "Yüklənmə", "Yüklənmə vəziyyəti görünmür."),
        text("script.js", "catch", 33, "Xəta", "Xəta tutumu görünmür."),
      ],
    }),
    step(7, "app-routes", "Marşrut və metadata", "next.dynamic-route", {
      objective: "Detal səhifəsi dinamik parametri oxusun.",
      instructions:
        "script.js şərhində tapşırıq detalının app/tasks/[id]/page.tsx yolunu yazın. Səhifə params Promise-ini await params ilə oxusun. export const metadata ilə sənəd başlığını verin.",
      checks: [
        text(
          "script.js",
          "app/tasks/[id]/page.tsx",
          34,
          "Dinamik yol",
          "Tapşırıq detalının dinamik yolu görünmür.",
        ),
        text("script.js", "await params", 33, "Parametr", "Dinamik parametr gözlənilmir."),
        text("script.js", "export const metadata", 33, "Metadata", "Sənəd metadatası görünmür."),
      ],
    }),
    step(8, "production-polish", "İstehsal cilası", "html.a11y", {
      objective: "Dar ekran və adlandırılmış düymə olsun.",
      instructions:
        "index.html içində silmə düyməsinə aria-label yazın. style.css içində dar ekran üçün @media qaydası yazın. script.js içində siyahını TaskList funksiyası kimi ayrıca saxlayın.",
      checks: [
        text("index.html", "aria-label", 34, "Adlandırılmış düymə", "Düymənin əlçatan adı yoxdur."),
        text("style.css", "@media", 33, "Dar ekran", "Dar ekran üçün media qaydası yoxdur."),
        text("script.js", "function TaskList", 33, "Siyahı komponenti", "Siyahı ayrıca komponent deyil."),
      ],
    }),
  ],
};

function step(
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

function attribute(
  tag: string,
  attributeName: string,
  value: string,
  points: number,
  label: string,
  feedback: string,
): ProjectSeed["milestones"][number]["checks"][number] {
  return { type: "html_attribute_equals", tag, attribute: attributeName, value, points, label, feedback };
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

function text(
  file: "index.html" | "style.css" | "script.js",
  value: string,
  points: number,
  label: string,
  feedback: string,
): ProjectSeed["milestones"][number]["checks"][number] {
  return { type: "contains_text", file, text: value, points, label, feedback };
}

function absent(
  file: "index.html" | "style.css" | "script.js",
  value: string,
  points: number,
  label: string,
  feedback: string,
): ProjectSeed["milestones"][number]["checks"][number] {
  return { type: "forbidden_text", file, text: value, points, label, feedback };
}
