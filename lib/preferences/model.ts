import { emptyPreferences, type FeedbackSignal, type PreferenceData, type PreferenceItem } from "./types";

// Pure preference-update logic (Feature 8). No I/O — the service layer loads and
// persists; this module only computes the next weights. Deterministic and fully
// inspectable, so the application (never the LLM) is the source of record.

// How much each signal moves a weight. A "like" reinforces, a "dislike"
// penalizes by the same magnitude, and a "skip" (show-another) is a weaker
// soft-negative — deliberately smaller than an explicit dislike.
const SIGNAL_WEIGHTS: Record<FeedbackSignal, { color: number; category: number; pairing: number }> = {
  like: { color: 1, category: 0.5, pairing: 1 },
  dislike: { color: -1, category: -0.5, pairing: -1 },
  skip: { color: -0.25, category: -0.1, pairing: -0.25 },
};

// Keep weights bounded so repeated feedback can't run away, and rounded so the
// stored JSON stays readable.
const CLAMP = 5;

/** Stable key for an unordered pair of item ids. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** All unordered item-pair keys within a set of item ids. */
export function pairKeys(ids: string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      keys.push(pairKey(ids[i], ids[j]));
    }
  }
  return keys;
}

/**
 * Fold one feedback signal over an outfit's items into a new preference model.
 * Returns a fresh object; the input is not mutated.
 */
export function applyFeedback(
  current: PreferenceData,
  items: PreferenceItem[],
  signal: FeedbackSignal,
): PreferenceData {
  const next: PreferenceData = {
    colors: { ...current.colors },
    categories: { ...current.categories },
    pairings: { ...current.pairings },
  };
  const w = SIGNAL_WEIGHTS[signal];

  for (const item of items) {
    if (item.color) {
      const key = item.color.toLowerCase();
      next.colors[key] = clamp((next.colors[key] ?? 0) + w.color);
    }
    next.categories[item.category] = clamp((next.categories[item.category] ?? 0) + w.category);
  }

  for (const key of pairKeys(items.map((i) => i.id))) {
    next.pairings[key] = clamp((next.pairings[key] ?? 0) + w.pairing);
  }

  return next;
}

/** Coerce arbitrary stored JSON into a valid, fully-populated PreferenceData. */
export function normalizePreferences(raw: unknown): PreferenceData {
  const base = emptyPreferences();
  if (!isRecord(raw)) return base;
  return {
    colors: isRecord(raw.colors) ? (raw.colors as Record<string, number>) : base.colors,
    categories: isRecord(raw.categories)
      ? (raw.categories as PreferenceData["categories"])
      : base.categories,
    pairings: isRecord(raw.pairings) ? (raw.pairings as Record<string, number>) : base.pairings,
  };
}

function clamp(value: number): number {
  const rounded = Number(value.toFixed(3));
  return Math.max(-CLAMP, Math.min(CLAMP, rounded));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
