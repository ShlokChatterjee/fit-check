import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";

// Shared test factory for outfit-logic specs. Not a test suite itself.

let seq = 0;

/** Build a WardrobeItem with sensible defaults; override any field. */
export function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  seq += 1;
  return {
    id: `item-${seq}`,
    userId: "user-1",
    category: Category.TOPS,
    name: `Item ${seq}`,
    color: null,
    pattern: null,
    material: null,
    descriptors: [],
    imageUrl: `/uploads/item-${seq}.jpg`,
    cropUrl: null,
    isFavorite: false,
    isActive: true,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides,
  };
}
