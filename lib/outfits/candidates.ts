import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import type { OutfitIntent } from "@/lib/ai/types";

import { groupByCategory } from "./constraints";
import { scoreCandidate, type PreferenceWeights } from "./scoring";
import type { OutfitCandidate, SlottedItem } from "./types";

// Candidate generation (Feature 6). The application — not the LLM — combines
// owned items across slots and enforces coverage. Every item in every candidate
// is a real, active WardrobeItem owned by the user; nothing is invented.

// Bound the combinatorics: only the strongest few items per slot enter the
// cartesian product, and the ranked result is capped.
const MAX_PER_SLOT = 6;
const MAX_CANDIDATES = 60;

/**
 * Build a ranked list of complete outfit candidates from the user's active
 * items. Returns an empty list when a required slot is uncovered (the caller
 * guards this via `missingRequiredSlots` before generation). Deterministic
 * given the same items, intent, and weights.
 */
export function buildRankedCandidates(
  activeItems: WardrobeItem[],
  intent: OutfitIntent,
  weights: PreferenceWeights = {},
): OutfitCandidate[] {
  const byCategory = topPerSlot(groupByCategory(activeItems));
  const tops = byCategory.get(Category.TOPS) ?? [];
  const bottoms = byCategory.get(Category.BOTTOMS) ?? [];
  const shoes = byCategory.get(Category.SHOES) ?? [];
  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) {
    return [];
  }

  const outerwear = byCategory.get(Category.OUTERWEAR) ?? [];
  const accessories = byCategory.get(Category.ACCESSORIES) ?? [];
  const wantsOuterwear = intent.weather === "cold" || intent.weather === "wet";

  const candidates: OutfitCandidate[] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const slotted: SlottedItem[] = [
          { slot: Category.TOPS, item: top },
          { slot: Category.BOTTOMS, item: bottom },
          { slot: Category.SHOES, item: shoe },
        ];
        // Optional slots: add the strongest available item deterministically.
        if (wantsOuterwear && outerwear[0]) {
          slotted.push({ slot: Category.OUTERWEAR, item: outerwear[0] });
        }
        if (accessories[0]) {
          slotted.push({ slot: Category.ACCESSORIES, item: accessories[0] });
        }
        const items = slotted.map((s) => s.item);
        candidates.push({ items: slotted, score: scoreCandidate(items, intent, weights) });
      }
    }
  }

  candidates.sort(
    (a, b) => b.score - a.score || signature(a).localeCompare(signature(b)),
  );
  return candidates.slice(0, MAX_CANDIDATES);
}

/** Stable identifier for a candidate: sorted item ids. Used for tie-breaking. */
export function signature(candidate: OutfitCandidate): string {
  return candidate.items
    .map((s) => s.item.id)
    .sort()
    .join(",");
}

/** Keep the strongest MAX_PER_SLOT items per category (favorites, then newest). */
function topPerSlot(
  byCategory: Map<Category, WardrobeItem[]>,
): Map<Category, WardrobeItem[]> {
  const result = new Map<Category, WardrobeItem[]>();
  for (const [category, list] of byCategory) {
    const sorted = [...list].sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
    result.set(category, sorted.slice(0, MAX_PER_SLOT));
  }
  return result;
}
