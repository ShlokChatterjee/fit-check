import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import { isCategory } from "./types";

describe("isCategory", () => {
  it("accepts every real category", () => {
    for (const category of Object.values(Category)) {
      expect(isCategory(category)).toBe(true);
    }
  });

  it("rejects unknown or non-string values", () => {
    expect(isCategory("HATS")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(123)).toBe(false);
  });
});
