import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import type { WardrobeItem } from "@/app/generated/prisma/client";

import { groupByCategory, meetsBaseline, missingRequiredSlots } from "./constraints";
import { makeItem } from "./test-utils";

describe("missingRequiredSlots", () => {
  it("returns all required slots for an empty wardrobe", () => {
    expect(missingRequiredSlots([])).toEqual([
      Category.TOPS,
      Category.BOTTOMS,
      Category.SHOES,
    ]);
  });

  it("returns only the uncovered required slots", () => {
    const items: WardrobeItem[] = [
      makeItem({ id: "t", category: Category.TOPS }),
      makeItem({ id: "s", category: Category.SHOES }),
    ];
    expect(missingRequiredSlots(items)).toEqual([Category.BOTTOMS]);
  });

  it("ignores optional slots when required ones are covered", () => {
    const items: WardrobeItem[] = [
      makeItem({ id: "t", category: Category.TOPS }),
      makeItem({ id: "b", category: Category.BOTTOMS }),
      makeItem({ id: "s", category: Category.SHOES }),
    ];
    expect(missingRequiredSlots(items)).toEqual([]);
    expect(meetsBaseline(items)).toBe(true);
  });
});

describe("groupByCategory", () => {
  it("buckets items by category preserving order", () => {
    const t1 = makeItem({ id: "t1", category: Category.TOPS });
    const t2 = makeItem({ id: "t2", category: Category.TOPS });
    const b1 = makeItem({ id: "b1", category: Category.BOTTOMS });
    const grouped = groupByCategory([t1, b1, t2]);
    expect(grouped.get(Category.TOPS)).toEqual([t1, t2]);
    expect(grouped.get(Category.BOTTOMS)).toEqual([b1]);
    expect(grouped.get(Category.SHOES)).toBeUndefined();
  });
});
