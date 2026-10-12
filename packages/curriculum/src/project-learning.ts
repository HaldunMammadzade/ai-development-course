import type {
  Difficulty,
  ProjectBrief,
  ProjectDifficultyBand,
  ProjectMilestoneStatus,
  ProjectMilestoneWorkflow,
  ProjectPortfolio,
} from "@platform/types";

const PORTFOLIO_BRIEF: ProjectBrief = {
  goal: "Kiçik, oxunaqlı bir portfolio səhifəsi qurun.",
  required: [
    "Səhifədə header, main və bir başlıq olsun",
    "Başlıqda Portfolio sözü olsun",
    "Xarici bir səhifəyə keçid olsun",
    "card sinfi olan bir bölmə olsun",
    "greet funksiyası salam qaytarsın",
    "Sənədin başlığı, footer və stylesheet keçidi olsun",
    "Mətn rəngi və başlıq boşluğu olsun",
  ],
  recommended: ["Qısa cümlələr yazın", "Təkrarlanan kart üçün bir class istifadə edin"],
  optional: ["Səhifənin adını bir şərhdə qeyd edin"],
};

const TASKFLOW_BRIEF: ProjectBrief = {
  goal: "TaskFlow, komanda üçün tapşırıq lövhəsidir. İstifadəçi tapşırığı yaradır, dəyişir, silir, statusuna görə axtarır və süzür.",
  required: [
    "Semantik səhifə, forma və etiket",
    "Tipli Task modeli və ayrı komponentlər",
    "Siyahı, boş vəziyyət və stabil açar",
    "İdarə olunan forma və boş başlığın rəddi",
    "Axtarış və status filtrini render zamanı hesablamaq",
    "Yüklənmə, xəta və yenidən cəhd",
    "Dashboard, tapşırıq detalı və metadata",
    "Dar ekran, aria-label və klaviatura ilə düymə",
  ],
  recommended: [
    "Qum qutusu Next.js serverini işə salmır. Səhifə quruluşunu index.html, stilləri style.css, TypeScript və React mənbəyini script.js içində yazın",
    "Tövsiyə olunan real quruluş: app/page.tsx, app/tasks/page.tsx, app/tasks/[id]/page.tsx, components və types",
    "Fayl adını məcburi saymayın. Yoxlama davranışı və anlayışı ölçür",
  ],
  optional: [
    "Mərhələlər server sırası ilə açılır",
    "Öz mühəndislik qərarınızı planda yazın",
  ],
};

export function projectBrief(slug: string): ProjectBrief | null {
  if (slug === "personal-portfolio") {
    return PORTFOLIO_BRIEF;
  }
  if (slug === "taskflow") {
    return TASKFLOW_BRIEF;
  }
  return null;
}

export function projectDifficultyBand(difficulty: Difficulty): ProjectDifficultyBand {
  if (difficulty === "advanced" || difficulty === "expert") {
    return "ADVANCED";
  }
  if (difficulty === "intermediate") {
    return "INTERMEDIATE";
  }
  return "FOUNDATION";
}

export interface ProjectSelectionInput {
  slug: string;
  title: string;
  completed: boolean;
  passedMilestones: number;
  difficulty: Difficulty;
  remediation: boolean;
  masteryHigh: boolean;
}

export function projectSelectionRank(project: ProjectSelectionInput): number {
  if (!project.completed && project.passedMilestones > 0) {
    return 0;
  }
  if (project.completed) {
    return 4;
  }
  if (project.remediation) {
    return 2;
  }
  if (projectDifficultyBand(project.difficulty) === "ADVANCED") {
    return project.masteryHigh ? 3 : 5;
  }
  return 1;
}

export function selectProjects<T extends ProjectSelectionInput>(projects: readonly T[]): T[] {
  return [...projects].sort(
    (left, right) =>
      projectSelectionRank(left) - projectSelectionRank(right) ||
      left.title.localeCompare(right.title) ||
      left.slug.localeCompare(right.slug),
  );
}

export function milestoneWorkflow(input: {
  status: ProjectMilestoneStatus;
  latestPassed: boolean | null;
  claimed: boolean;
}): ProjectMilestoneWorkflow {
  if (input.status === "passed") {
    return "PASSED";
  }
  if (input.status === "locked") {
    return "TODO";
  }
  if (input.claimed) {
    return "SUBMITTED";
  }
  if (input.latestPassed === false) {
    return "FAILED";
  }
  return "IN_PROGRESS";
}

export function projectPortfolio(input: {
  title: string;
  objective: string;
  completed: boolean;
  completedAt: string | null;
  milestones: ReadonlyArray<{
    title: string;
    status: ProjectMilestoneStatus;
    concepts?: ReadonlyArray<{ slug: string; name: string }>;
  }>;
}): ProjectPortfolio | null {
  if (!input.completed || input.completedAt === null) {
    return null;
  }
  if (input.milestones.some((item) => item.status !== "passed")) {
    return null;
  }
  const skills: string[] = [];
  const technologies: string[] = [];
  for (const milestone of input.milestones) {
    for (const concept of milestone.concepts ?? []) {
      if (!skills.includes(concept.name)) {
        skills.push(concept.name);
      }
      const technology = technologyForConcept(concept.slug);
      if (technology !== null && !technologies.includes(technology)) {
        technologies.push(technology);
      }
    }
  }
  return {
    title: input.title,
    problem: input.objective,
    technologies,
    features: input.milestones.map((item) => item.title),
    skills,
    completedAt: input.completedAt,
  };
}

function technologyForConcept(slug: string): string | null {
  if (slug.startsWith("html.")) {
    return "HTML";
  }
  if (slug.startsWith("css.") || slug === "web.css") {
    return "CSS";
  }
  if (slug.startsWith("js.") || slug === "web.javascript") {
    return "JavaScript";
  }
  if (slug.startsWith("ts.")) {
    return "TypeScript";
  }
  if (slug.startsWith("react.")) {
    return "React";
  }
  if (slug.startsWith("next.")) {
    return "Next.js";
  }
  return null;
}
