import { describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

// Force the deterministic fallback path so this suite is offline and stable
// even when AI_PROVIDER_API_KEY is present in the environment. Live provider
// behavior is covered by provider.integration.test.ts.
vi.mock("./provider", async (importActual) => ({
  ...(await importActual<typeof import("./provider")>()),
  isAiConfigured: () => false,
}));

import { analyzeClothing } from "./analyze-clothing";

describe("analyzeClothing (stub)", () => {
  it("requires an image input", async () => {
    await expect(analyzeClothing({})).rejects.toThrow();
  });

  it("returns a prediction set matching the DetectedItem contract", async () => {
    const detections = await analyzeClothing({ imageUrl: "https://example.com/a.jpg" });

    expect(Array.isArray(detections)).toBe(true);
    expect(detections.length).toBeGreaterThan(0);

    for (const d of detections) {
      expect(Object.values(Category)).toContain(d.category);
      expect(typeof d.name).toBe("string");
      expect(Array.isArray(d.descriptors)).toBe(true);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });
});
