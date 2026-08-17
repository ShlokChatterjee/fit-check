import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import type { OutfitIntent } from "@/lib/ai/types";

// Application-owned types for outfit generation (Feature 6). The LLM interprets
// language and phrases explanations; it never assembles outfits, enforces
// constraints, or claims ownership. Everything here is deterministic app logic.

/** Slots every generated outfit must cover before generation is offered. */
export const REQUIRED_SLOTS = [
  Category.TOPS,
  Category.BOTTOMS,
  Category.SHOES,
] as const;

/** Slots that may be added to a candidate but are never required. */
export const OPTIONAL_SLOTS = [Category.OUTERWEAR, Category.ACCESSORIES] as const;

/** One item assigned to the slot it fills within a candidate outfit. */
export interface SlottedItem {
  slot: Category;
  item: WardrobeItem;
}

/** A complete, ranked candidate outfit built from owned items. */
export interface OutfitCandidate {
  items: SlottedItem[];
  score: number;
}

/** A single item as served to the UI (no full DB row, no ownership logic). */
export interface ServedOutfitItem {
  wardrobeItemId: string;
  slot: Category;
  name: string;
  category: Category;
  color: string | null;
  imageUrl: string;
}

/** A persisted, served outfit returned to the client. */
export interface ServedOutfit {
  outfitId: string;
  request: string;
  explanation: string;
  items: ServedOutfitItem[];
  /** True when a lower-ranked candidate exists to "show another". */
  hasMore: boolean;
}

/** Result of a generation request: either an outfit or the add-basics guard. */
export type GenerateOutfitResult =
  | { status: "ok"; outfit: ServedOutfit }
  | { status: "needs_basics"; missingSlots: Category[] };

/** Result of advancing to the next-ranked candidate. */
export type ShowAnotherResult =
  | { status: "ok"; outfit: ServedOutfit }
  | { status: "no_more" };

/**
 * Shape persisted in `Outfit.context`. Holds the interpreted intent plus the
 * full ranked candidate set (as item-id references) and the served cursor, so
 * "show another" can advance deterministically without re-running the AI or
 * re-scoring. Item references are re-validated against the owned wardrobe on
 * every advance — the stored set is a plan, never a claim of ownership.
 */
export interface StoredOutfitContext {
  intent: OutfitIntent;
  candidates: Array<{
    score: number;
    items: Array<{ slot: Category; wardrobeItemId: string }>;
  }>;
  cursor: number;
}

export class OutfitNotFoundError extends Error {
  constructor() {
    super("Outfit not found");
    this.name = "OutfitNotFoundError";
  }
}
