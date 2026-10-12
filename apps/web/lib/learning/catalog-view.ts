import type { LearningCatalog, LearningCatalogLesson } from "@platform/types";

export interface CurrentLesson {
  moduleTitle: string;
  lesson: LearningCatalogLesson;
}

export function findCurrentLesson(catalog: LearningCatalog): CurrentLesson | null {
  for (const pathModule of catalog.modules) {
    for (const lesson of pathModule.lessons) {
      if (lesson.availability === "current") {
        return { moduleTitle: pathModule.title, lesson };
      }
    }
  }
  return null;
}

export function conceptName(catalog: LearningCatalog, slug: string): string {
  return catalog.concepts.find((concept) => concept.slug === slug)?.name ?? slug;
}

export function lessonHref(slug: string): string {
  return `/app/learn/${slug}`;
}

export function lessonPageAccess(catalog: LearningCatalog, slug: string): "open" | "locked" {
  const lesson = catalog.modules
    .flatMap((pathModule) => pathModule.lessons)
    .find((item) => item.slug === slug);
  if (lesson === undefined || lesson.availability === "locked") {
    return "locked";
  }
  return "open";
}
