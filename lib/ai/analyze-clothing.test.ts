import { describe, expect, it } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
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
