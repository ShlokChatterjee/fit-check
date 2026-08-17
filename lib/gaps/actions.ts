"use server";

import { requireUserId } from "@/lib/auth/guards";

import { getGapSuggestions } from "./service";
import type { GapResult } from "./types";

/** Run wardrobe gap analysis for the authenticated user, on request (Feature 9). */
export async function getGapSuggestionsAction(): Promise<GapResult> {
  const userId = await requireUserId();
  return getGapSuggestions(userId);
}
