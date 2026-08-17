import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import { generateOutfitExplanation } from "./generate-outfit-explanation";

describe("generateOutfitExplanation (stub)", () => {
  it("mentions each item and the ownership framing", async () => {
    const text = await generateOutfitExplanation({
      intent: { formality: "smart_casual", descriptors: [] },
      items: [
        { category: Category.TOPS, name: "White shirt" },
        { category: Category.BOTTOMS, name: "Navy chinos" },
      ],
    });

    expect(text.toLowerCase()).toContain("white shirt");
    expect(text.toLowerCase()).toContain("navy chinos");
    expect(text.toLowerCase()).toContain("already own");
  });

  it("weaves in interpreted context when present", async () => {
    const text = await generateOutfitExplanation({
      intent: { occasion: "brunch", weather: "warm", descriptors: [] },
      items: [{ category: Category.TOPS, name: "Linen shirt" }],
    });

    expect(text.toLowerCase()).toContain("brunch");
    expect(text.toLowerCase()).toContain("warm");
  });
});
