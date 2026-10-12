import { testingLessons } from "@platform/curriculum";
import { TestingWorkspace } from "@/components/testing/testing-workspace";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCatalog, loadLessonExercises } from "@/lib/api/server";

export default async function TestingPage() {
  const catalog = await readPageData(loadCatalog);
  if (typeof catalog === "string") {
    return <LoadError message={catalog} />;
  }
  const testingModule = catalog.modules.find((item) => item.slug === "testing");
  const lessons = testingModule?.lessons ?? [];
  const active =
    lessons.find(
      (lesson) => lesson.availability === "current" || lesson.availability === "practice",
    ) ??
    lessons.find((lesson) => lesson.availability !== "completed") ??
    lessons[lessons.length - 1] ??
    null;
  const source =
    active === null ? undefined : testingLessons.find((lesson) => lesson.slug === active.slug);
  const reading =
    source?.blocks.find((block) => block.type === "reading")?.markdown.split("\n\n") ?? [];
  const open = active !== null && active.availability !== "locked";
  const loaded = open ? await readPageData(() => loadLessonExercises(active.slug)) : null;
  const exercises = loaded === null || typeof loaded === "string" ? [] : loaded.exercises;
  return (
    <TestingWorkspace
      lessons={lessons.map((lesson) => ({ slug: lesson.slug, availability: lesson.availability }))}
      active={active}
      reading={open ? reading : []}
      exercises={exercises}
    />
  );
}
