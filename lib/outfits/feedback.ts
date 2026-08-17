import type { Feedback } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordOutfitFeedback } from "@/lib/preferences/service";

import { OutfitNotFoundError } from "./types";

// Outfit-level feedback (Feature 7). Like/dislike is the core V1 signal.
// Ownership is enforced in application code — the outfit must belong to the
// user. Persisting the signal is application logic; the same signal is folded
// into the inspectable preference model (Feature 8, lib/preferences).

/**
 * Record (or update) a user's like/dislike for one of their outfits. Upserts so
 * a user can change their mind; the `Feedback.outfitId` unique constraint keeps
 * it to one rating per outfit. The signal is also folded into the user's
 * preference model so it shapes future generation.
 */
export async function submitFeedback(
  userId: string,
  outfitId: string,
  liked: boolean,
): Promise<Feedback> {
  const outfit = await prisma.outfit.findFirst({
    where: { id: outfitId, userId },
    include: { items: { include: { wardrobeItem: true } } },
  });
  if (!outfit) throw new OutfitNotFoundError();

  const feedback = await prisma.feedback.upsert({
    where: { outfitId },
    create: { userId, outfitId, liked },
    update: { liked },
  });

  // Feature 8: reinforce (like) or penalize (dislike) the constituent items.
  const items = outfit.items.map((oi) => ({
    id: oi.wardrobeItem.id,
    category: oi.wardrobeItem.category,
    color: oi.wardrobeItem.color,
  }));
  await recordOutfitFeedback(userId, items, liked ? "like" : "dislike");

  return feedback;
}

/** Read the user's feedback for an outfit, or null if none has been given. */
export async function getFeedback(
  userId: string,
  outfitId: string,
): Promise<Feedback | null> {
  return prisma.feedback.findFirst({ where: { outfitId, userId } });
}
