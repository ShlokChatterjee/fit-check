import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import type { OutfitIntent } from "@/lib/ai/types";

// Candidate scoring (Feature 6) is application logic. Preference weights are
// supplied by the caller — Feature 8 will feed learned weights here; until then
// callers pass an empty object and scoring falls back to coherence heuristics.
// The LLM may re-rank the top candidates and explain, but the base score is
// deterministic app logic, never a model decision.

/**
 * Inspectable preference weights (mirrors `Preference.data`, Feature 8).
 * Positive values reward, negative penalize. All keys optional.
 */
export interface PreferenceWeights {
  colors?: Record<string, number>;
  categories?: Partial<Record<Category, number>>;
}

/**
 * Score one candidate's items given the interpreted intent and optional learned
 * preferences. Higher is better. Pure and deterministic given the same input.
 */
export function scoreCandidate(
  items: WardrobeItem[],
  intent: OutfitIntent,
  weights: PreferenceWeights = {},
): number {
  let score = 0;
  const hasOuterwear = items.some((i) => i.category === Category.OUTERWEAR);

  for (const item of items) {
    // Favorites are a mild positive signal the user already expressed.
    if (item.isFavorite) score += 1;

    // Learned preferences (Feature 8): color and category weights.
    if (item.color) {
      const w = weights.colors?.[item.color.toLowerCase()];
      if (w) score += w;
    }
    const catWeight = weights.categories?.[item.category];
    if (catWeight) score += catWeight;

    // Reward items whose descriptors echo the interpreted request.
    score += descriptorOverlap(item.descriptors, intent.descriptors) * 0.5;
  }

  // Weather coherence: outerwear helps when cold/wet, hurts when hot.
  if (intent.weather === "cold" || intent.weather === "wet") {
    if (hasOuterwear) score += 1.5;
  } else if (intent.weather === "hot") {
    score += hasOuterwear ? -1 : 0.5;
  }

  return score;
}

/** Count of shared descriptors between an item and the request (case-insensitive). */
function descriptorOverlap(itemDescriptors: string[], intent: string[]): number {
  if (itemDescriptors.length === 0 || intent.length === 0) return 0;
  const wanted = new Set(intent.map((d) => d.toLowerCase()));
  return itemDescriptors.filter((d) => wanted.has(d.toLowerCase())).length;
}
