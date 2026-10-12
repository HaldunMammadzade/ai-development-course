"use client";

import { useState } from "react";
import Link from "next/link";
import type { SkillGraph, SkillGraphConcept, SkillGraphModule, SkillState } from "@platform/types";
import { Sheet } from "@/components/ui/overlay";
import { copy } from "@/lib/copy";
import { lessonHref } from "@/lib/learning/catalog-view";
import { cn } from "@/lib/utils";

const mark: Record<SkillState, string> = {
  unknown: "bg-[var(--color-border-strong)]",
  weak: "bg-[var(--warning)]",
  developing: "bg-[var(--info)]",
  strong: "bg-[var(--success)]",
};

export function SkillMap({ graph }: { graph: SkillGraph }) {
  const bySlug = new Map(graph.concepts.map((concept) => [concept.slug, concept]));
  const initial = graph.focus?.concepts.find((concept) => concept.mark === "current")?.slug ?? null;
  const [selected, setSelected] = useState<string | null>(initial);
  const [sheet, setSheet] = useState(false);
  const concept = selected === null ? null : (bySlug.get(selected) ?? null);

  function choose(slug: string) {
    setSelected(slug);
    setSheet(true);
  }

  return (
    <div className="grid min-w-0 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 gap-10">
        <section className="grid min-w-0 gap-4" aria-labelledby="skill-map-heading">
          <div className="grid gap-2">
            <h2 id="skill-map-heading" className="font-serif text-2xl">
              {copy.progress.map}
            </h2>
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {copy.progress.mapLead}
            </p>
          </div>
          <div className="grid gap-3">
            {graph.modules.map((module) => (
              <ModuleBlock
                key={module.slug}
                module={module}
                concepts={bySlug}
                initiallyOpen={module.title === graph.focus?.moduleTitle}
                selected={selected}
                onChoose={choose}
              />
            ))}
          </div>
        </section>
        <NameSection
          id="weak-concepts"
          title={copy.progress.weak}
          concepts={graph.concepts.filter((item) => item.state === "weak")}
          selected={selected}
          onChoose={choose}
          review
        />
        <NameSection
          id="strong-concepts"
          title={copy.progress.strong}
          concepts={graph.concepts.filter((item) => item.state === "strong")}
          selected={selected}
          onChoose={choose}
        />
        <section className="grid gap-3" aria-labelledby="module-overview">
          <h2 id="module-overview" className="font-serif text-2xl">
            {copy.progress.overview}
          </h2>
          <ul className="grid gap-3">
            {graph.modules.map((module) => (
              <li key={module.slug} className="min-w-0">
                <p className="font-medium">{module.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{countLine(module)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="hidden min-w-0 xl:sticky xl:top-6 xl:block">
        <Detail concept={concept} heading onChoose={choose} />
      </aside>
      <Sheet
        open={sheet && concept !== null}
        until="xl"
        side="right"
        title={concept?.name ?? copy.progress.map}
        closeLabel={copy.progress.close}
        onClose={() => setSheet(false)}
      >
        {concept !== null ? (
          <div className="grid gap-4">
            <Detail concept={concept} heading={false} onChoose={choose} />
            <button
              type="button"
              className="inline-flex min-h-11 w-fit items-center text-sm font-medium"
              onClick={() => setSheet(false)}
            >
              {copy.progress.close}
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function ModuleBlock({
  module,
  concepts,
  initiallyOpen,
  selected,
  onChoose,
}: {
  module: SkillGraphModule;
  concepts: Map<string, SkillGraphConcept>;
  initiallyOpen: boolean;
  selected: string | null;
  onChoose: (slug: string) => void;
}) {
  return (
    <details
      className="min-w-0 border-b border-[var(--color-border-subtle)]"
      open={initiallyOpen || undefined}
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2">
        <span className="font-medium">{module.title}</span>
        <span className="text-sm text-muted-foreground">
          {module.counts.total} {copy.progress.conceptCount}
        </span>
      </summary>
      <ul className="grid pb-4">
        {module.conceptSlugs.map((slug) => {
          const concept = concepts.get(slug);
          if (concept === undefined) {
            return null;
          }
          return (
            <li key={slug}>
              <ConceptButton concept={concept} selected={selected === slug} onChoose={onChoose} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function NameSection({
  id,
  title,
  concepts,
  selected,
  onChoose,
  review = false,
}: {
  id: string;
  title: string;
  concepts: SkillGraphConcept[];
  selected: string | null;
  onChoose: (slug: string) => void;
  review?: boolean;
}) {
  if (concepts.length === 0) {
    return null;
  }
  return (
    <section className="grid min-w-0 gap-3" aria-labelledby={id}>
      <h2 id={id} className="font-serif text-2xl">
        {title}
      </h2>
      <ul className="grid gap-2">
        {concepts.map((concept) => (
          <li key={concept.slug} className="grid">
            <ConceptButton
              concept={concept}
              selected={selected === concept.slug}
              onChoose={onChoose}
            />
            {review ? <ReviewLink concept={concept} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConceptButton({
  concept,
  selected,
  onChoose,
}: {
  concept: SkillGraphConcept;
  selected: boolean;
  onChoose: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={() => onChoose(concept.slug)}
      className={cn(
        "flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--color-border-subtle)] py-2 text-left",
        selected && "shadow-[inset_2px_0_0_var(--color-accent-fill)]",
      )}
    >
      <span className="min-w-0 break-words font-medium">{concept.name}</span>
      <span className="grid min-w-0 justify-items-end gap-0.5 text-right">
        <StateText state={concept.state} />
        {concept.revision !== null ? (
          <span className="text-sm text-muted-foreground">
            {copy.revision.states[concept.revision]}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function StateText({ state }: { state: SkillState }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className={cn("size-2", mark[state])} />
      {copy.progress.states[state]}
    </span>
  );
}

function ReviewLink({ concept }: { concept: SkillGraphConcept }) {
  const href = legalLessonHref(concept);
  if (href === null) {
    return null;
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center px-3 text-sm font-medium underline-offset-4 hover:underline"
    >
      {copy.progress.review}
    </Link>
  );
}

function Detail({
  concept,
  heading,
  onChoose,
}: {
  concept: SkillGraphConcept | null;
  heading: boolean;
  onChoose: (slug: string) => void;
}) {
  if (concept === null) {
    return (
      <div className="surface p-4">
        <p className="text-sm leading-6 text-muted-foreground">{copy.progress.select}</p>
      </div>
    );
  }
  const href = legalLessonHref(concept);
  const evidence =
    concept.evidenceSource === null ? null : copy.dashboard.activitySource[concept.evidenceSource];
  return (
    <div className="surface grid min-w-0 gap-4 p-4">
      {heading ? <h2 className="font-serif text-2xl break-words">{concept.name}</h2> : null}
      <p className="text-sm leading-6">{copy.progress.states[concept.state]}</p>
      {concept.revision !== null ? (
        <p className="text-sm leading-6">{copy.revision.states[concept.revision]}</p>
      ) : null}
      {concept.summary.length > 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{concept.summary}</p>
      ) : null}
      <RelationList
        title={copy.progress.prerequisites}
        concepts={concept.prerequisites}
        onChoose={onChoose}
      />
      <RelationList
        title={copy.progress.dependents}
        concepts={concept.dependents}
        onChoose={onChoose}
      />
      <div className="grid gap-1">
        <h3 className="text-sm font-medium text-muted-foreground">{copy.progress.lesson}</h3>
        <p className="break-words text-sm leading-6">{concept.lessonTitle}</p>
        {href !== null ? (
          <Link
            href={href}
            className="inline-flex min-h-11 w-fit items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            {concept.state === "weak" || concept.lessonAvailability === "completed"
              ? copy.progress.review
              : copy.progress.openLesson}
          </Link>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{copy.progress.locked}</p>
        )}
      </div>
      {evidence !== null ? (
        <p className="text-sm leading-6">
          {copy.progress.evidence}: {evidence}
        </p>
      ) : null}
    </div>
  );
}

function RelationList({
  title,
  concepts,
  onChoose,
}: {
  title: string;
  concepts: SkillGraphConcept["prerequisites"];
  onChoose: (slug: string) => void;
}) {
  if (concepts.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="grid gap-2 border-l border-[var(--color-border-strong)] pl-3">
        {concepts.map((concept) => (
          <li key={concept.slug}>
            <button
              type="button"
              onClick={() => onChoose(concept.slug)}
              className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 break-words text-sm font-medium">{concept.name}</span>
              <StateText state={concept.state} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function legalLessonHref(concept: SkillGraphConcept): string | null {
  if (concept.lessonAvailability === "locked") {
    return null;
  }
  return lessonHref(concept.lessonSlug);
}

function countLine(module: SkillGraphModule): string {
  const parts = (["strong", "developing", "weak", "unknown"] as const).flatMap((state) =>
    module.counts[state] > 0 ? [`${module.counts[state]} ${copy.progress.counts[state]}`] : [],
  );
  return [`${module.counts.total} ${copy.progress.conceptCount}`, ...parts].join(" · ");
}
