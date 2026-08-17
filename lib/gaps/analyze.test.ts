import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";
import { makeItem } from "@/lib/outfits/test-utils";

import { analyzeGaps } from "./analyze";

/** Build a wardrobe with the given per-category counts. */
function wardrobe(counts: Partial<Record<Category, number>>): WardrobeItem[] {
  const items: WardrobeItem[] = [];
  for (const [category, n] of Object.entries(counts)) {
    for (let i = 0; i < (n ?? 0); i++) {
      items.push(makeItem({ category: category as Category }));
    }
  }
  return items;
}

describe("analyzeGaps", () => {
  it("surfaces the under-covered required slot and quantifies the unlock", () => {
    // 1 top, 3 bottoms, 3 shoes → a top is the bottleneck (unlocks 3×3 = 9).
    // Optionals are already owned, so the only gap is the thin required slot.
    const gaps = analyzeGaps(
      wardrobe({
        [Category.TOPS]: 1,
        [Category.BOTTOMS]: 3,
        [Category.SHOES]: 3,
        [Category.OUTERWEAR]: 1,
        [Category.ACCESSORIES]: 1,
      }),
    );

    expect(gaps).toHaveLength(1);
    expect(gaps[0].category).toBe(Category.TOPS);
    expect(gaps[0].addedOutfits).toBe(9);
    expect(gaps[0].reason).toContain("9");
  });

  it("never suggests a category the user already stocks the most of", () => {
    // 3 tops, 1 bottom, 1 shoe → tops are best-covered, so never suggested.
    const gaps = analyzeGaps(
      wardrobe({ [Category.TOPS]: 3, [Category.BOTTOMS]: 1, [Category.SHOES]: 1 }),
    );

    const categories = gaps.map((g) => g.category);
    expect(categories).not.toContain(Category.TOPS);
    expect(categories).toEqual(
      expect.arrayContaining([Category.BOTTOMS, Category.SHOES]),
    );
  });

  it("suggests optional layers only when the user owns none", () => {
    // Balanced basics, no outerwear/accessories → suggest both optionals.
    const gaps = analyzeGaps(
      wardrobe({ [Category.TOPS]: 2, [Category.BOTTOMS]: 2, [Category.SHOES]: 2 }),
    );
    const categories = gaps.map((g) => g.category);
    expect(categories).toEqual(
      expect.arrayContaining([Category.OUTERWEAR, Category.ACCESSORIES]),
    );
    // Each enables a variant across all 8 base outfits.
    expect(gaps.every((g) => g.addedOutfits === 8)).toBe(true);
  });

  it("returns nothing for a balanced, fully-covered wardrobe", () => {
    const gaps = analyzeGaps(
      wardrobe({
        [Category.TOPS]: 2,
        [Category.BOTTOMS]: 2,
        [Category.SHOES]: 2,
        [Category.OUTERWEAR]: 1,
        [Category.ACCESSORIES]: 1,
      }),
    );
    expect(gaps).toEqual([]);
  });

  it("ranks suggestions by additional outfits unlocked", () => {
    const gaps = analyzeGaps(
      wardrobe({ [Category.TOPS]: 1, [Category.BOTTOMS]: 2, [Category.SHOES]: 5 }),
    );
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].addedOutfits).toBeGreaterThanOrEqual(gaps[i].addedOutfits);
    }
    // Bottoms unlock the fewest here (1×5 = 5), so they rank last.
    expect(gaps[gaps.length - 1].category).toBe(Category.BOTTOMS);
  });
});
