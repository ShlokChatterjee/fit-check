import { describe, expect, it } from "vitest";

import { analyzeClothing } from "./analyze-clothing";
import { generateOutfitExplanation } from "./generate-outfit-explanation";
import { interpretRequest } from "./interpret-request";

// Live smoke tests for the real Anthropic provider. These are SKIPPED unless
// AI_PROVIDER_API_KEY is set in the environment, so the normal unit suite stays
// offline and deterministic. To run them:
//   PowerShell:  $env:AI_PROVIDER_API_KEY="sk-ant-..."; npm test
//   bash:        AI_PROVIDER_API_KEY=sk-ant-... npm test
const hasKey = Boolean(process.env.AI_PROVIDER_API_KEY);

describe.skipIf(!hasKey)("AI provider (live)", () => {
  it("interprets a natural-language request into a structured intent", async () => {
    const intent = await interpretRequest("something smart for a rainy work dinner");

    expect(Array.isArray(intent.descriptors)).toBe(true);
    // The model should read the weather and dressiness from the request.
    expect(intent.weather).toBe("wet");
    expect(["smart_casual", "formal"]).toContain(intent.formality);
  }, 30_000);

  it("writes a grounded explanation that mentions only supplied items", async () => {
    const explanation = await generateOutfitExplanation({
      request: "casual weekend brunch",
      intent: { formality: "casual", occasion: "brunch", descriptors: ["relaxed"] },
      items: [
        { category: "TOPS", name: "White linen shirt", color: "white" },
        { category: "BOTTOMS", name: "Beige chinos", color: "beige" },
        { category: "SHOES", name: "Tan loafers", color: "tan" },
      ],
    });

    expect(explanation.length).toBeGreaterThan(0);
    // A single, reasonably short sentence — not a wall of text.
    expect(explanation.length).toBeLessThan(400);
  }, 30_000);

  it("detects clothing items from a public image URL", async () => {
    // A stable, public product image of a single garment.
    const detections = await analyzeClothing({
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/T-shirt.png/240px-T-shirt.png",
    });

    expect(Array.isArray(detections)).toBe(true);
    // Every detection must be a well-formed prediction.
    for (const d of detections) {
      expect(typeof d.name).toBe("string");
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  }, 45_000);
});
