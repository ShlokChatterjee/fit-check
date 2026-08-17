import type { Formality, OutfitIntent, Weather } from "./types";

// Keyword tables used by the deterministic stub interpreter.
const WEATHER_KEYWORDS: Array<[Weather, string[]]> = [
  ["wet", ["rain", "rainy", "wet", "drizzle", "snow", "snowy"]],
  ["cold", ["cold", "winter", "freezing", "chilly"]],
  ["hot", ["hot", "summer", "heat", "sweltering"]],
  ["warm", ["warm", "spring"]],
  ["mild", ["mild", "cool", "autumn", "fall"]],
];

const FORMALITY_KEYWORDS: Array<[Formality, string[]]> = [
  ["formal", ["formal", "black tie", "wedding", "interview", "gala", "suit"]],
  ["smart_casual", ["smart", "business casual", "smart casual", "work", "office", "dinner", "date"]],
  ["casual", ["casual", "relaxed", "weekend", "brunch", "lounge", "everyday"]],
];

const STOPWORDS = new Set([
  "a", "an", "the", "for", "to", "of", "and", "or", "with", "in", "on",
  "something", "outfit", "wear", "wearing", "want", "need", "some", "me",
  "my", "look", "like", "day", "that", "this",
]);

/**
 * Interpret a natural-language outfit request into a structured intent
 * (Feature 6). Interpretation only — the application decides how the intent
 * maps to hard constraints; this function enforces nothing and owns nothing.
 *
 * STUB: a deterministic keyword heuristic stands in until AI_PROVIDER_API_KEY
 * is set, at which point a provider call replaces the body. The return shape is
 * the stable contract.
 */
export async function interpretRequest(prompt: string): Promise<OutfitIntent> {
  const text = prompt.toLowerCase();

  const weather = firstMatch(text, WEATHER_KEYWORDS);
  const formality = firstMatch(text, FORMALITY_KEYWORDS);
  const occasion = extractOccasion(text);

  return {
    ...(occasion ? { occasion } : {}),
    ...(weather ? { weather } : {}),
    ...(formality ? { formality } : {}),
    descriptors: extractDescriptors(text),
  };
}

function firstMatch<T extends string>(
  text: string,
  table: Array<[T, string[]]>,
): T | undefined {
  for (const [value, keywords] of table) {
    if (keywords.some((kw) => text.includes(kw))) {
      return value;
    }
  }
  return undefined;
}

function extractOccasion(text: string): string | undefined {
  for (const [, keywords] of FORMALITY_KEYWORDS) {
    for (const kw of keywords) {
      if (["brunch", "work", "office", "dinner", "date", "wedding", "interview", "gala"].includes(kw) && text.includes(kw)) {
        return kw;
      }
    }
  }
  return undefined;
}

function extractDescriptors(text: string): string[] {
  return Array.from(
    new Set(
      text
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  );
}
