import { missingRequiredSlots } from "@/lib/outfits/constraints";
import { listWardrobe } from "@/lib/wardrobe/service";

import { analyzeGaps } from "./analyze";
import type { GapResult } from "./types";

// On-request wardrobe gap analysis (Feature 9). Runs only when the user asks;
// never surfaced proactively. Requires the same baseline as generation
// (≥1 active item per required slot) before producing suggestions.

export async function getGapSuggestions(userId: string): Promise<GapResult> {
  const active = await listWardrobe(userId, { activeOnly: true });

  const missing = missingRequiredSlots(active);
  if (missing.length > 0) {
    return { status: "needs_basics", missingSlots: missing };
  }

  return { status: "ok", suggestions: analyzeGaps(active) };
}
