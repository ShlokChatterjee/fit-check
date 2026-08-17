import type { Category } from "@/app/generated/prisma/client";

// Duplicate prevention is application logic, not an AI decision
// (see Claude/plan.md Feature 5). These helpers are pure and deterministic.

export interface DuplicateCandidate {
  category: Category;
  name: string;
  color?: string | null;
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Jaccard token overlap of two item names, in [0, 1]. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection += 1;
  }
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

const NAME_SIMILARITY_THRESHOLD = 0.5;

/** True when two items are likely the same physical garment. */
export function isLikelyDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  if (a.category !== b.category) return false;
  // A clear color mismatch rules out a duplicate.
  if (a.color && b.color && normalize(a.color) !== normalize(b.color)) return false;
  return nameSimilarity(a.name, b.name) >= NAME_SIMILARITY_THRESHOLD;
}

/** Return the existing items that likely duplicate the candidate. */
export function findLikelyDuplicates<T extends DuplicateCandidate>(
  candidate: DuplicateCandidate,
  existing: T[],
): T[] {
  return existing.filter((item) => isLikelyDuplicate(candidate, item));
}
