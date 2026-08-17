import type { Prisma, WardrobeItem } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { interpretRequest } from "@/lib/ai/interpret-request";
import { generateOutfitExplanation } from "@/lib/ai/generate-outfit-explanation";
import type { OutfitIntent } from "@/lib/ai/types";
import { listWardrobe } from "@/lib/wardrobe/service";
import { loadPreferences, recordOutfitFeedback } from "@/lib/preferences/service";

import { buildRankedCandidates } from "./candidates";
import { missingRequiredSlots } from "./constraints";
import {
  OutfitNotFoundError,
  type GenerateOutfitResult,
  type OutfitCandidate,
  type ServedOutfit,
  type ServedOutfitItem,
  type ShowAnotherResult,
  type StoredOutfitContext,
} from "./types";

// Outfit generation pipeline (Feature 6). The application owns the guard,
// candidate generation, hard constraints, scoring, ranking, and persistence.
// The AI layer only interprets the request and phrases the explanation. Every
// served item is a real WardrobeItem owned by the authenticated user.

/**
 * Generate an outfit from the user's owned, active items for a natural-language
 * request. Guards on the baseline (≥1 active item per required slot) and, when
 * met, serves the top-ranked candidate and persists it.
 */
export async function generateOutfit(
  userId: string,
  request: string,
): Promise<GenerateOutfitResult> {
  const active = await listWardrobe(userId, { activeOnly: true });

  const missing = missingRequiredSlots(active);
  if (missing.length > 0) {
    return { status: "needs_basics", missingSlots: missing };
  }

  const intent = await interpretRequest(request);
  const prefs = await loadPreferences(userId);
  const candidates = buildRankedCandidates(active, intent, prefs);

  // Defensive: baseline is met but no complete candidate could be formed.
  if (candidates.length === 0) {
    return { status: "needs_basics", missingSlots: missingRequiredSlots(active) };
  }

  const outfit = await persistCandidate(userId, request, intent, candidates, 0);
  return { status: "ok", outfit };
}

/**
 * Advance to the next-ranked candidate of a previously served outfit. Skipping
 * the current outfit records a soft-negative signal (Feature 8) — weaker than an
 * explicit dislike. Re-validates every stored item reference against the
 * currently owned, active wardrobe, skipping candidates that are no longer
 * buildable.
 */
export async function showAnotherOutfit(
  userId: string,
  previousOutfitId: string,
): Promise<ShowAnotherResult> {
  const previous = await prisma.outfit.findFirst({
    where: { id: previousOutfitId, userId },
  });
  if (!previous || !previous.context) {
    throw new OutfitNotFoundError();
  }

  const context = previous.context as unknown as StoredOutfitContext;
  const active = await listWardrobe(userId, { activeOnly: true });
  const byId = new Map(active.map((item) => [item.id, item]));

  // The user is leaving the current candidate: fold in the soft-negative skip.
  await recordSkip(userId, context.candidates[context.cursor], byId);

  // Walk forward from the current cursor to the next still-buildable candidate.
  for (let cursor = context.cursor + 1; cursor < context.candidates.length; cursor++) {
    const rebuilt = rebuildCandidate(context.candidates[cursor], byId);
    if (!rebuilt) continue;

    const outfit = await persistServedCandidate(
      userId,
      previous.request ?? "",
      context.intent,
      context.candidates,
      cursor,
      rebuilt,
    );
    return { status: "ok", outfit };
  }

  return { status: "no_more" };
}

/** Record the soft-negative skip for a candidate the user is leaving behind. */
async function recordSkip(
  userId: string,
  skipped: StoredOutfitContext["candidates"][number] | undefined,
  byId: Map<string, WardrobeItem>,
): Promise<void> {
  if (!skipped) return;
  const items = skipped.items
    .map((ref) => byId.get(ref.wardrobeItemId))
    .filter((item): item is WardrobeItem => Boolean(item))
    .map((item) => ({ id: item.id, category: item.category, color: item.color }));
  if (items.length > 0) {
    await recordOutfitFeedback(userId, items, "skip");
  }
}

/** Persist a freshly ranked candidate at the given cursor and serve it. */
async function persistCandidate(
  userId: string,
  request: string,
  intent: OutfitIntent,
  candidates: OutfitCandidate[],
  cursor: number,
): Promise<ServedOutfit> {
  const context: StoredOutfitContext = {
    intent,
    cursor,
    candidates: candidates.map((c) => ({
      score: c.score,
      items: c.items.map((s) => ({ slot: s.slot, wardrobeItemId: s.item.id })),
    })),
  };
  return persistFromCandidate(userId, request, intent, context, candidates[cursor]);
}

/** Persist an advanced candidate (context already built) and serve it. */
async function persistServedCandidate(
  userId: string,
  request: string,
  intent: OutfitIntent,
  storedCandidates: StoredOutfitContext["candidates"],
  cursor: number,
  candidate: OutfitCandidate,
): Promise<ServedOutfit> {
  const context: StoredOutfitContext = { intent, cursor, candidates: storedCandidates };
  return persistFromCandidate(userId, request, intent, context, candidate);
}

/** Shared persistence: create the Outfit + OutfitItems and shape the response. */
async function persistFromCandidate(
  userId: string,
  request: string,
  intent: OutfitIntent,
  context: StoredOutfitContext,
  candidate: OutfitCandidate,
): Promise<ServedOutfit> {
  const explanation = await generateOutfitExplanation({
    request,
    intent,
    items: candidate.items.map((s) => ({
      category: s.item.category,
      name: s.item.name,
      color: s.item.color ?? undefined,
    })),
  });

  const created = await prisma.outfit.create({
    data: {
      userId,
      request,
      explanation,
      score: candidate.score,
      context: context as unknown as Prisma.InputJsonValue,
      items: {
        create: candidate.items.map((s) => ({
          wardrobeItemId: s.item.id,
          slot: s.slot,
        })),
      },
    },
  });

  return {
    outfitId: created.id,
    request,
    explanation,
    items: candidate.items.map(toServedItem),
    hasMore: context.cursor < context.candidates.length - 1,
  };
}

/** Rebuild a stored candidate from currently owned items, or null if incomplete. */
function rebuildCandidate(
  stored: StoredOutfitContext["candidates"][number],
  byId: Map<string, WardrobeItem>,
): OutfitCandidate | null {
  const items = [];
  for (const ref of stored.items) {
    const item = byId.get(ref.wardrobeItemId);
    if (!item) return null; // an item was deactivated or deleted since generation
    items.push({ slot: ref.slot, item });
  }
  return { items, score: stored.score };
}

function toServedItem(slotted: OutfitCandidate["items"][number]): ServedOutfitItem {
  return {
    wardrobeItemId: slotted.item.id,
    slot: slotted.slot,
    name: slotted.item.name,
    category: slotted.item.category,
    color: slotted.item.color,
    imageUrl: slotted.item.imageUrl,
  };
}
