import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import { CATEGORY_LABELS } from "@/lib/wardrobe/labels";
import { OPTIONAL_SLOTS, REQUIRED_SLOTS } from "@/lib/outfits/types";

import type { GapSuggestion } from "./types";

// Pure gap analysis (Feature 9). Grounded entirely in the wardrobe's own counts:
// a complete outfit is one top + one bottom + one pair of shoes, so the number
// of complete outfits is tops × bottoms × shoes. Adding an item to a required
// slot multiplies the combinations; adding a first optional layer/accessory
// enables a variant across every existing outfit. The AI is never consulted —
// the gap is computed, not guessed.

// Type-level phrasing for a suggested addition (not a specific product/brand).
const ADD_LABEL: Record<Category, string> = {
  [Category.TOPS]: "a top",
  [Category.BOTTOMS]: "a pair of bottoms",
  [Category.SHOES]: "a pair of shoes",
  [Category.OUTERWEAR]: "a layer of outerwear",
  [Category.ACCESSORIES]: "an accessory",
};

/**
 * Suggest category-level wardrobe additions, ranked by how many additional
 * complete outfits each would unlock. Only surfaces under-covered categories —
 * a category the user already stocks as well as their best-covered basic (or an
 * optional they already own) is never suggested.
 */
export function analyzeGaps(items: WardrobeItem[]): GapSuggestion[] {
  const count = (c: Category) => items.filter((i) => i.category === c).length;
  const tops = count(Category.TOPS);
  const bottoms = count(Category.BOTTOMS);
  const shoes = count(Category.SHOES);
  const baseOutfits = tops * bottoms * shoes;
  const maxRequired = Math.max(tops, bottoms, shoes);

  // Marginal complete outfits from one more item in each required slot.
  const requiredMarginal: Record<string, number> = {
    [Category.TOPS]: bottoms * shoes,
    [Category.BOTTOMS]: tops * shoes,
    [Category.SHOES]: tops * bottoms,
  };
  const requiredCount: Record<string, number> = {
    [Category.TOPS]: tops,
    [Category.BOTTOMS]: bottoms,
    [Category.SHOES]: shoes,
  };

  const suggestions: GapSuggestion[] = [];

  // Under-covered required slots: those with fewer items than the best-covered
  // basic. A slot the user stocks as deeply as their strongest one is "enough".
  for (const c of REQUIRED_SLOTS) {
    if (requiredCount[c] < maxRequired) {
      const added = requiredMarginal[c];
      suggestions.push({
        category: c,
        label: ADD_LABEL[c],
        addedOutfits: added,
        reason: requiredReason(c, added),
      });
    }
  }

  // Optional slots the user owns none of — adding one enables a variant across
  // every existing outfit. Owning one already counts as sufficient.
  for (const c of OPTIONAL_SLOTS) {
    if (count(c) === 0) {
      suggestions.push({
        category: c,
        label: ADD_LABEL[c],
        addedOutfits: baseOutfits,
        reason: optionalReason(c, baseOutfits),
      });
    }
  }

  return suggestions.sort((a, b) => b.addedOutfits - a.addedOutfits);
}

function requiredReason(category: Category, added: number): string {
  return `Your ${CATEGORY_LABELS[category].toLowerCase()} are the thinnest of your basics — adding ${ADD_LABEL[category]} would unlock about ${added} more complete ${outfits(added)}.`;
}

function optionalReason(category: Category, base: number): string {
  if (category === Category.OUTERWEAR) {
    return `You don't own any outerwear yet — adding ${ADD_LABEL[category]} would let your ${base} ${outfits(base)} handle cold or wet weather.`;
  }
  return `You don't own any accessories yet — adding ${ADD_LABEL[category]} would give your ${base} ${outfits(base)} a finishing touch for dressier occasions.`;
}

function outfits(n: number): string {
  return n === 1 ? "outfit" : "outfits";
}
