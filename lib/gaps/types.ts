import type { Category } from "@/app/generated/prisma/enums";

// Wardrobe gap analysis (Feature 9). Suggestions are category/type-level and are
// computed from the actual wardrobe — never brands, products, or shopping links.

export interface GapSuggestion {
  /** The category whose coverage is thin. */
  category: Category;
  /** A short, type-level label for what to add (e.g. "a pair of bottoms"). */
  label: string;
  /** Why it helps — which combinations adding it would enable. */
  reason: string;
  /** How many additional complete outfits adding one such item would unlock. */
  addedOutfits: number;
}

/** Result of an on-request gap analysis. */
export type GapResult =
  | { status: "ok"; suggestions: GapSuggestion[] }
  | { status: "needs_basics"; missingSlots: Category[] };
