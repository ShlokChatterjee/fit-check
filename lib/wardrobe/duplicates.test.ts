import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import {
  findLikelyDuplicates,
  isLikelyDuplicate,
  nameSimilarity,
  normalize,
} from "./duplicates";

describe("normalize", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalize("  Navy   Jacket ")).toBe("navy jacket");
  });
});

describe("nameSimilarity", () => {
  it("is 1 for identical names", () => {
    expect(nameSimilarity("white t-shirt", "White T-Shirt")).toBe(1);
  });

  it("is 0 for fully disjoint names", () => {
    expect(nameSimilarity("blue jeans", "leather boots")).toBe(0);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const score = nameSimilarity("white cotton shirt", "white shirt");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe("isLikelyDuplicate", () => {
  it("flags same-category items with matching names", () => {
    expect(
      isLikelyDuplicate(
        { category: Category.TOPS, name: "White T-shirt" },
        { category: Category.TOPS, name: "white t shirt" },
      ),
    ).toBe(true);
  });

  it("does not flag items in different categories", () => {
    expect(
      isLikelyDuplicate(
        { category: Category.TOPS, name: "White T-shirt" },
        { category: Category.BOTTOMS, name: "White T-shirt" },
      ),
    ).toBe(false);
  });

  it("does not flag when colors clearly conflict", () => {
    expect(
      isLikelyDuplicate(
        { category: Category.TOPS, name: "T-shirt", color: "white" },
        { category: Category.TOPS, name: "T-shirt", color: "black" },
      ),
    ).toBe(false);
  });
});

describe("findLikelyDuplicates", () => {
  it("returns only the likely-matching existing items", () => {
    const existing = [
      { id: "1", category: Category.TOPS, name: "White T-shirt", color: "white" },
      { id: "2", category: Category.TOPS, name: "Black hoodie", color: "black" },
      { id: "3", category: Category.BOTTOMS, name: "White T-shirt", color: "white" },
    ];
    const matches = findLikelyDuplicates(
      { category: Category.TOPS, name: "White T-shirt", color: "white" },
      existing,
    );
    expect(matches.map((m) => m.id)).toEqual(["1"]);
  });
});
