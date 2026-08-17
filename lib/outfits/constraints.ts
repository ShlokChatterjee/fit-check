import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";

import { REQUIRED_SLOTS } from "./types";

// Hard constraints for outfit generation (Feature 6) are application logic —
// never an AI decision. These helpers are pure and deterministic.

/** Group items by their category, preserving input order within each group. */
export function groupByCategory(
  items: WardrobeItem[],
): Map<Category, WardrobeItem[]> {
  const map = new Map<Category, WardrobeItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

/**
 * Required slots that have no covering item in the given set. Callers pass the
 * user's *active* items; a non-empty result means generation cannot proceed and
 * the user is prompted to add the basics instead.
 */
export function missingRequiredSlots(items: WardrobeItem[]): Category[] {
  return REQUIRED_SLOTS.filter(
    (slot) => !items.some((item) => item.category === slot),
  );
}

/** True when at least one active item covers each required slot. */
export function meetsBaseline(items: WardrobeItem[]): boolean {
  return missingRequiredSlots(items).length === 0;
}
