import type { Feedback } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import { OutfitNotFoundError } from "./types";

// Outfit-level feedback (Feature 7). Like/dislike is the core V1 signal.
// Ownership is enforced in application code — the outfit must belong to the
// user. Persisting the signal is application logic here; consuming it to update
// the preference model is Feature 8 (lib/preferences).

/**
 * Record (or update) a user's like/dislike for one of their outfits. Upserts so
 * a user can change their mind; the `Feedback.outfitId` unique constraint keeps
 * it to one rating per outfit. Feedback is linked to the outfit — and thereby to
 * its constituent items and the user — for later preference learning.
 */
export async function submitFeedback(
  userId: string,
  outfitId: string,
  liked: boolean,
): Promise<Feedback> {
  const outfit = await prisma.outfit.findFirst({
    where: { id: outfitId, userId },
    select: { id: true },
  });
  if (!outfit) throw new OutfitNotFoundError();

  return prisma.feedback.upsert({
    where: { outfitId },
    create: { userId, outfitId, liked },
    update: { liked },
  });
}

/** Read the user's feedback for an outfit, or null if none has been given. */
export async function getFeedback(
  userId: string,
  outfitId: string,
): Promise<Feedback | null> {
  return prisma.feedback.findFirst({ where: { outfitId, userId } });
}
