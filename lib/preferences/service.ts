import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import { applyFeedback, normalizePreferences } from "./model";
import { emptyPreferences, type FeedbackSignal, type PreferenceData, type PreferenceItem } from "./types";

// Ownership-scoped preference storage (Feature 8). Preferences are owned per
// user (Preference.userId is unique) and always read/written by the application
// — inspectable and resettable, never opaque model state.

/** Read the user's preference model, or an empty one if none exists yet. */
export async function loadPreferences(userId: string): Promise<PreferenceData> {
  const row = await prisma.preference.findUnique({ where: { userId } });
  return row ? normalizePreferences(row.data) : emptyPreferences();
}

/**
 * Fold an outfit's feedback signal into the user's preference model and persist
 * it. Returns the updated model. Application logic — the LLM is never consulted.
 */
export async function recordOutfitFeedback(
  userId: string,
  items: PreferenceItem[],
  signal: FeedbackSignal,
): Promise<PreferenceData> {
  const current = await loadPreferences(userId);
  const next = applyFeedback(current, items, signal);
  const data = next as unknown as Prisma.InputJsonValue;

  await prisma.preference.upsert({
    where: { userId },
    create: { userId, data },
    update: { data },
  });

  return next;
}

/** Reset the user's preference model back to empty (fully app-controlled). */
export async function resetPreferences(userId: string): Promise<void> {
  const data = emptyPreferences() as unknown as Prisma.InputJsonValue;
  await prisma.preference.upsert({
    where: { userId },
    create: { userId, data },
    update: { data },
  });
}
