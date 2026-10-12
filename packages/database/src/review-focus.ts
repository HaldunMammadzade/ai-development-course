import type { NextAction } from "@platform/types";

export function reviewSlugIfPrimary(
  slug: string | null | undefined,
  primaryConceptSlugs: readonly string[],
): string | null {
  if (slug === null || slug === undefined || slug.length === 0) {
    return null;
  }
  return primaryConceptSlugs.includes(slug) ? slug : null;
}

export function newSessionReviewFocus(
  action: NextAction,
  primaryConceptSlugs: readonly string[],
): { ok: true; slug: string | null } | { ok: false } {
  if (action.kind !== "review_concept") {
    return { ok: true, slug: null };
  }
  const slug = reviewSlugIfPrimary(action.conceptSlug, primaryConceptSlugs);
  if (slug === null) {
    return { ok: false };
  }
  return { ok: true, slug };
}
