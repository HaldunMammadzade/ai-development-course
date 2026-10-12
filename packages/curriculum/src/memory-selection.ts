export const MAX_TEACHER_MEMORY = 3;

const MEMORY_CATEGORIES = new Set(["learning", "mistake", "preference"]);

export interface MemoryCandidate {
  category: string;
  conceptSlug: string | null;
  content: string;
  createdAt: Date;
}

export interface SelectedMemory {
  category: "learning" | "mistake" | "preference";
  conceptSlug: string | null;
  content: string;
}

export function selectTeacherMemory(input: {
  notes: readonly MemoryCandidate[];
  lessonConceptSlugs: ReadonlySet<string>;
  weakConceptSlugs: ReadonlySet<string>;
}): SelectedMemory[] {
  const notes = input.notes.flatMap((note) => {
    if (!MEMORY_CATEGORIES.has(note.category)) {
      return [];
    }
    const content = note.content
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 280);
    if (content.length === 0) {
      return [];
    }
    return [
      {
        category: note.category as SelectedMemory["category"],
        conceptSlug: note.conceptSlug,
        content,
        createdAt: note.createdAt,
      },
    ];
  });
  const inScope = (slug: string | null): boolean =>
    slug !== null && (input.lessonConceptSlugs.has(slug) || input.weakConceptSlugs.has(slug));
  const newest = (
    left: { createdAt: Date; content: string },
    right: { createdAt: Date; content: string },
  ): number =>
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.content.localeCompare(right.content);

  const buckets = [
    notes.filter((note) => note.category === "mistake" && inScope(note.conceptSlug)).sort(newest),
    notes.filter((note) => note.category === "preference").sort(newest),
    notes.filter((note) => note.category === "learning" && inScope(note.conceptSlug)).sort(newest),
  ];
  const selected: SelectedMemory[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const note of bucket) {
      if (selected.length === MAX_TEACHER_MEMORY) {
        return selected;
      }
      const key = `${note.category}\n${note.conceptSlug ?? ""}\n${note.content}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      selected.push({
        category: note.category,
        conceptSlug: note.conceptSlug,
        content: note.content,
      });
    }
  }
  return selected;
}
