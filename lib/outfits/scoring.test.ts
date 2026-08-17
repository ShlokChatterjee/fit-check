import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import type { OutfitIntent } from "@/lib/ai/types";
import { pairKey } from "@/lib/preferences/model";
import { emptyPreferences } from "@/lib/preferences/types";

import { scoreCandidate } from "./scoring";
import { makeItem } from "./test-utils";

const NEUTRAL: OutfitIntent = { descriptors: [] };

describe("scoreCandidate", () => {
  it("rewards favorite items", () => {
    const plain = [makeItem({ isFavorite: false })];
    const favorite = [makeItem({ isFavorite: true })];
    expect(scoreCandidate(favorite, NEUTRAL)).toBeGreaterThan(
      scoreCandidate(plain, NEUTRAL),
    );
  });

  it("rewards descriptor overlap with the interpreted request", () => {
    const items = [makeItem({ descriptors: ["bold", "linen"] })];
    const matching: OutfitIntent = { descriptors: ["bold"] };
    expect(scoreCandidate(items, matching)).toBeGreaterThan(
      scoreCandidate(items, NEUTRAL),
    );
  });

  it("boosts outerwear in cold or wet weather", () => {
    const withOuter = [
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.OUTERWEAR }),
    ];
    const withoutOuter = [makeItem({ category: Category.TOPS })];
    const wet: OutfitIntent = { descriptors: [], weather: "wet" };
    expect(scoreCandidate(withOuter, wet)).toBeGreaterThan(
      scoreCandidate(withoutOuter, wet),
    );
  });

  it("penalizes outerwear in hot weather", () => {
    const withOuter = [
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.OUTERWEAR }),
    ];
    const withoutOuter = [makeItem({ category: Category.TOPS })];
    const hot: OutfitIntent = { descriptors: [], weather: "hot" };
    expect(scoreCandidate(withoutOuter, hot)).toBeGreaterThan(
      scoreCandidate(withOuter, hot),
    );
  });

  it("applies learned color and category preference weights", () => {
    const items = [makeItem({ color: "Navy", category: Category.TOPS })];
    const weighted = scoreCandidate(items, NEUTRAL, {
      ...emptyPreferences(),
      colors: { navy: 2 },
      categories: { [Category.TOPS]: 1 },
    });
    expect(weighted).toBe(scoreCandidate(items, NEUTRAL) + 3);
  });

  it("applies learned pairing weights between items", () => {
    const a = makeItem({ id: "a", category: Category.TOPS });
    const b = makeItem({ id: "b", category: Category.BOTTOMS });
    const items = [a, b];
    const weighted = scoreCandidate(items, NEUTRAL, {
      ...emptyPreferences(),
      pairings: { [pairKey("a", "b")]: 2 },
    });
    // Pairing contributes at half weight (2 * 0.5 = 1).
    expect(weighted).toBe(scoreCandidate(items, NEUTRAL) + 1);
  });
});
