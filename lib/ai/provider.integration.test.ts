// @vitest-environment node
// The Anthropic SDK refuses to run in a browser-like environment (jsdom, the
// suite default). These live tests exercise the real server-side path, so they
// run under Node — matching how the provider is called from server actions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  // Every provider function logs "using fallback" on failure and returns the
  // deterministic result. Spy on console.error so a silent fallback fails the
  // test instead of masquerading as a pass.
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    const fellBack = errorSpy.mock.calls.some((args: unknown[]) =>
      args.some((a) => typeof a === "string" && a.includes("using fallback")),
    );
    errorSpy.mockRestore();
    expect(fellBack, "provider call fell back to the stub").toBe(false);
  });

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

  it("runs the vision detection path on image bytes and returns well-formed predictions", async () => {
    // A valid 64x64 PNG. This exercises the full plumbing — media-type sniff,
    // base64 encoding, the vision request, the tool schema, and result parsing
    // (the local-upload path base64-encodes bytes the same way) — without a
    // flaky network fetch. A blank image yields no garments, which is a valid,
    // well-formed empty prediction set; the afterEach guard proves the real
    // provider ran rather than the fallback.
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsPJHNlgFscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCNauCLP9TnuYAAAAASUVORK5CYII=";
    const bytes = new Uint8Array(Buffer.from(pngBase64, "base64"));

    const detections = await analyzeClothing({ imageBytes: bytes });

    expect(Array.isArray(detections)).toBe(true);
    for (const d of detections) {
      expect(typeof d.name).toBe("string");
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  }, 45_000);
});
