import { LockedLesson } from "@/components/curriculum/locked-lesson";
import { ExerciseBoard } from "@/components/exercises/exercise-board";
import { LessonExperience } from "@/components/teaching/lesson-experience";
import { LoadError } from "@/components/ui/load-error";
import { ErrorState } from "@/components/ui/status";
import { readPageData } from "@/lib/api/page-data";
import { loadCatalog, loadLessonExercises } from "@/lib/api/server";
import { copy } from "@/lib/copy";
import { findCurrentLesson, lessonHref, lessonPageAccess } from "@/lib/learning/catalog-view";

export default async function LessonPage({ params }: { params: Promise<{ lessonSlug: string }> }) {
  const { lessonSlug } = await params;
  const catalog = await readPageData(loadCatalog);
  if (typeof catalog === "string") {
    return <LoadError message={catalog} />;
  }
  if (lessonPageAccess(catalog, lessonSlug) === "locked") {
    const current = findCurrentLesson(catalog);
    return (
      <LockedLesson href={current === null ? "/app/learn" : lessonHref(current.lesson.slug)} />
    );
  }
  const exercises = await readPageData(() => loadLessonExercises(lessonSlug));
  const published = typeof exercises === "string" || exercises === null ? [] : exercises.exercises;
  return (
    <LessonExperience slug={lessonSlug} catalog={catalog}>
      {typeof exercises === "string" ? (
        <ErrorState title={copy.exercise.title} body={exercises} />
      ) : null}
      {published.length > 0 ? <ExerciseBoard exercises={published} /> : null}
    </LessonExperience>
  );
}
