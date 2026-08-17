import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

import { applyFeedback, normalizePreferences, pairKey, pairKeys } from "./model";
import { emptyPreferences, type PreferenceItem } from "./types";

const TOP: PreferenceItem = { id: "top-1", category: Category.TOPS, color: "Navy" };
const SHOES: PreferenceItem = { id: "shoes-1", category: Category.SHOES, color: "White" };

describe("pairKey / pairKeys", () => {
  it("is order-independent", () => {
    expect(pairKey("b", "a")).toBe(pairKey("a", "b"));
  });

  it("produces every unordered pair", () => {
    expect(pairKeys(["a", "b", "c"]).sort()).toEqual(["a|b", "a|c", "b|c"]);
  });
});

describe("applyFeedback", () => {
  it("reinforces colors, categories, and pairings on a like", () => {
    const next = applyFeedback(emptyPreferences(), [TOP, SHOES], "like");
    expect(next.colors.navy).toBe(1);
    expect(next.colors.white).toBe(1);
    expect(next.categories[Category.TOPS]).toBe(0.5);
    expect(next.pairings[pairKey("top-1", "shoes-1")]).toBe(1);
  });

  it("penalizes on a dislike", () => {
    const next = applyFeedback(emptyPreferences(), [TOP], "dislike");
    expect(next.colors.navy).toBe(-1);
    expect(next.categories[Category.TOPS]).toBe(-0.5);
  });

  it("treats a skip as a weaker negative than a dislike", () => {
    const skip = applyFeedback(emptyPreferences(), [TOP], "skip");
    const dislike = applyFeedback(emptyPreferences(), [TOP], "dislike");
    expect(skip.colors.navy).toBeLessThan(0);
    expect(skip.colors.navy).toBeGreaterThan(dislike.colors.navy);
  });

  it("accumulates across repeated feedback without mutating the input", () => {
    const first = applyFeedback(emptyPreferences(), [TOP], "like");
    const second = applyFeedback(first, [TOP], "like");
    expect(second.colors.navy).toBe(2);
    expect(first.colors.navy).toBe(1); // input untouched
  });

  it("clamps weights to a bounded range", () => {
    let prefs = emptyPreferences();
    for (let i = 0; i < 20; i++) prefs = applyFeedback(prefs, [TOP], "like");
    expect(prefs.colors.navy).toBeLessThanOrEqual(5);
  });

  it("ignores color weights for items without a color", () => {
    const next = applyFeedback(emptyPreferences(), [{ id: "x", category: Category.BOTTOMS, color: null }], "like");
    expect(Object.keys(next.colors)).toHaveLength(0);
    expect(next.categories[Category.BOTTOMS]).toBe(0.5);
  });
});

describe("normalizePreferences", () => {
  it("fills missing sections from arbitrary stored JSON", () => {
    expect(normalizePreferences(null)).toEqual(emptyPreferences());
    expect(normalizePreferences({ colors: { navy: 2 } })).toEqual({
      colors: { navy: 2 },
      categories: {},
      pairings: {},
    });
  });
});
