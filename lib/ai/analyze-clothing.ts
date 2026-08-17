import { Category } from "@/app/generated/prisma/enums";

import { isAiConfigured } from "./provider";
import type { DetectedItem } from "./types";

export interface AnalyzeClothingInput {
  /** URL of the submitted image, or... */
  imageUrl?: string;
  /** ...raw bytes. One of the two must be provided. */
  imageBytes?: Uint8Array;
}

/**
 * Detect distinct clothing items in one image (Feature 4).
 *
 * Contract: interpretation only. Returns a prediction set — never persists,
 * never claims ownership. The application decides what (if anything) is saved,
 * after user review.
 *
 * STUB: until AI_PROVIDER_API_KEY is set, returns a deterministic placeholder
 * so the ingestion pipeline is runnable end-to-end. The real implementation
 * calls a vision-capable provider via ./provider.
 */
export async function analyzeClothing(
  input: AnalyzeClothingInput,
): Promise<DetectedItem[]> {
  if (!input.imageUrl && !input.imageBytes) {
    throw new Error("analyzeClothing requires imageUrl or imageBytes");
  }

  if (!isAiConfigured()) {
    return stubDetections();
  }

  // TODO: call the configured vision provider and map its response to
  // DetectedItem[]. Kept behind this module so callers never see the SDK.
  return stubDetections();
}

function stubDetections(): DetectedItem[] {
  return [
    {
      category: Category.TOPS,
      name: "White T-shirt",
      color: "white",
      descriptors: ["cotton", "crew neck"],
      confidence: 0.9,
    },
    {
      category: Category.BOTTOMS,
      name: "Blue jeans",
      color: "blue",
      descriptors: ["denim", "slim"],
      confidence: 0.86,
    },
  ];
}
