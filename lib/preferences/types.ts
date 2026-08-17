import type { Category } from "@/app/generated/prisma/enums";

// The per-user preference model (Feature 8). This is the exact shape stored in
// `Preference.data` — plain, inspectable JSON the application reads, scores
// against, and resets. It is never opaque model state and never shared across
// users (see Claude/implementation.md §7).

export interface PreferenceData {
  /** color (lowercased) -> weight. Positive = preferred, negative = disliked. */
  colors: Record<string, number>;
  /** category -> weight. Captures e.g. a dislike of outfits carrying accessories. */
  categories: Partial<Record<Category, number>>;
  /** item-pair key -> weight. Which pairings tested well or poorly together. */
  pairings: Record<string, number>;
}

/** Minimal item shape needed to update or score preferences. */
export interface PreferenceItem {
  id: string;
  category: Category;
  color: string | null;
}

/** Feedback signals, strongest to weakest. "skip" is the soft-negative. */
export type FeedbackSignal = "like" | "dislike" | "skip";

/** A fresh, empty preference model. */
export function emptyPreferences(): PreferenceData {
  return { colors: {}, categories: {}, pairings: {} };
}
