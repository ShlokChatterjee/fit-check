"use server";

import { requireUserId } from "@/lib/auth/guards";

import * as service from "./service";
import type { GenerateOutfitResult, ShowAnotherResult } from "./types";

// Server actions for outfit generation (Feature 6). Each re-derives the user
// from the session and scopes all work to that user — ownership is enforced in
// application code, never by the LLM.

/** Generate an outfit for a natural-language request. */
export async function generateOutfitAction(
  request: string,
): Promise<GenerateOutfitResult> {
  const userId = await requireUserId();
  return service.generateOutfit(userId, request.trim());
}

/** Advance to the next-ranked candidate of a previously served outfit. */
export async function showAnotherOutfitAction(
  previousOutfitId: string,
): Promise<ShowAnotherResult> {
  const userId = await requireUserId();
  return service.showAnotherOutfit(userId, previousOutfitId);
}
