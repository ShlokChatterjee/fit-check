import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import type { OutfitIntent } from "@/lib/ai/types";

import { buildRankedCandidates, signature } from "./candidates";
import { makeItem } from "./test-utils";

const NEUTRAL: OutfitIntent = { descriptors: [] };

function baseWardrobe() {
  return [
    makeItem({ id: "top-1", category: Category.TOPS }),
    makeItem({ id: "top-2", category: Category.TOPS }),
    makeItem({ id: "bottom-1", category: Category.BOTTOMS }),
    makeItem({ id: "shoes-1", category: Category.SHOES }),
  ];
}

describe("buildRankedCandidates", () => {
  it("returns no candidates when a required slot is uncovered", () => {
    const items = [
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.BOTTOMS }),
      // no shoes
    ];
    expect(buildRankedCandidates(items, NEUTRAL)).toEqual([]);
  });

  it("covers every required slot in each candidate", () => {
    const candidates = buildRankedCandidates(baseWardrobe(), NEUTRAL);
    expect(candidates.length).toBe(2); // 2 tops × 1 bottom × 1 shoe
    for (const candidate of candidates) {
      const slots = candidate.items.map((s) => s.slot);
      expect(slots).toContain(Category.TOPS);
      expect(slots).toContain(Category.BOTTOMS);
      expect(slots).toContain(Category.SHOES);
    }
  });

  it("only uses items that exist in the wardrobe", () => {
    const items = baseWardrobe();
    const ownedIds = new Set(items.map((i) => i.id));
    for (const candidate of buildRankedCandidates(items, NEUTRAL)) {
      for (const s of candidate.items) {
        expect(ownedIds.has(s.item.id)).toBe(true);
      }
    }
  });

  it("includes outerwear in cold/wet weather but not otherwise", () => {
    const items = [...baseWardrobe(), makeItem({ id: "coat", category: Category.OUTERWEAR })];
    const wet = buildRankedCandidates(items, { descriptors: [], weather: "wet" });
    const warm = buildRankedCandidates(items, { descriptors: [], weather: "warm" });

    expect(wet.every((c) => c.items.some((s) => s.slot === Category.OUTERWEAR))).toBe(true);
    expect(warm.every((c) => c.items.some((s) => s.slot === Category.OUTERWEAR))).toBe(false);
  });

  it("ranks favorites ahead of plain items", () => {
    const items = [
      makeItem({ id: "top-plain", category: Category.TOPS, isFavorite: false }),
      makeItem({ id: "top-fav", category: Category.TOPS, isFavorite: true }),
      makeItem({ id: "bottom-1", category: Category.BOTTOMS }),
      makeItem({ id: "shoes-1", category: Category.SHOES }),
    ];
    const [best] = buildRankedCandidates(items, NEUTRAL);
    expect(best.items.some((s) => s.item.id === "top-fav")).toBe(true);
  });

  it("produces a stable signature independent of item order", () => {
    const [candidate] = buildRankedCandidates(baseWardrobe(), NEUTRAL);
    const sig = signature(candidate);
    const reordered = { ...candidate, items: [...candidate.items].reverse() };
    expect(signature(reordered)).toBe(sig);
  });
});
