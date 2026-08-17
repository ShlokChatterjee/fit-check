import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import type { OutfitIntent } from "@/lib/ai/types";
import { pairKeys } from "@/lib/preferences/model";
import { emptyPreferences, type PreferenceData } from "@/lib/preferences/types";

// Candidate scoring (Feature 6) folds in the learned preference model
// (Feature 8). Preference weights are supplied by the caller — an empty model
// falls back to coherence heuristics alone. The LLM may re-rank the top
// candidates and explain, but the base score is deterministic app logic.

/**
 * Score one candidate's items given the interpreted intent and the user's
 * learned preferences. Higher is better. Pure and deterministic.
 */
export function scoreCandidate(
  items: WardrobeItem[],
  intent: OutfitIntent,
  prefs: PreferenceData = emptyPreferences(),
): number {
  let score = 0;
  const hasOuterwear = items.some((i) => i.category === Category.OUTERWEAR);

  for (const item of items) {
    // Favorites are a mild positive signal the user already expressed.
    if (item.isFavorite) score += 1;

    // Learned preferences (Feature 8): color and category weights.
    if (item.color) {
      const w = prefs.colors[item.color.toLowerCase()];
      if (w) score += w;
    }
    const catWeight = prefs.categories[item.category];
    if (catWeight) score += catWeight;

    // Reward items whose descriptors echo the interpreted request.
    score += descriptorOverlap(item.descriptors, intent.descriptors) * 0.5;
  }

  // Learned pairing preferences: which items tested well or poorly together.
  for (const key of pairKeys(items.map((i) => i.id))) {
    const w = prefs.pairings[key];
    if (w) score += w * 0.5;
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
