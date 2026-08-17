import type Anthropic from "@anthropic-ai/sdk";

import {
  aiConfig,
  getAiClient,
  isAiConfigured,
  toolInputFromMessage,
} from "./provider";
import type { Formality, OutfitIntent, Weather } from "./types";

const WEATHER_VALUES: Weather[] = ["hot", "warm", "mild", "cold", "wet"];
const FORMALITY_VALUES: Formality[] = ["casual", "smart_casual", "formal"];

// Keyword tables used by the deterministic fallback interpreter.
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

const SYSTEM_PROMPT = `You interpret a person's natural-language outfit request into a structured intent.
Extract only what the request implies; leave a field unset when the request does not indicate it.
- weather: the weather the outfit should suit.
- formality: how dressy the outfit should be.
- occasion: a short noun for the event (e.g. "brunch", "work", "wedding") when one is named.
- descriptors: a few lowercase style adjectives drawn from or implied by the request (e.g. "bold", "cozy", "minimal").
You only interpret language. You never choose clothing, decide ownership, or enforce anything.`;

// Tool schema: the model records the interpreted intent as structured data.
const INTENT_TOOL: Anthropic.Tool = {
  name: "record_outfit_intent",
  description: "Record the structured intent interpreted from the outfit request.",
  input_schema: {
    type: "object",
    properties: {
      occasion: { type: "string", description: "Short noun for the event, if named." },
      weather: { type: "string", enum: WEATHER_VALUES },
      formality: { type: "string", enum: FORMALITY_VALUES },
      descriptors: {
        type: "array",
        items: { type: "string" },
        description: "A few lowercase style adjectives.",
      },
    },
    required: ["descriptors"],
  },
};

/**
 * Interpret a natural-language outfit request into a structured intent
 * (Feature 6). Interpretation only — the application decides how the intent
 * maps to hard constraints; this function enforces nothing and owns nothing.
 *
 * Uses the configured vision-capable Claude model when a key is set; otherwise
 * falls back to a deterministic keyword heuristic so the app runs without one.
 * Any provider error also falls back, so generation never fails on the AI call.
 */
export async function interpretRequest(prompt: string): Promise<OutfitIntent> {
  if (isAiConfigured()) {
    try {
      return await interpretWithProvider(prompt);
    } catch (error) {
      console.error("interpretRequest: provider call failed, using fallback", error);
    }
  }
  return interpretWithKeywords(prompt);
}

async function interpretWithProvider(prompt: string): Promise<OutfitIntent> {
  const client = getAiClient();
  const message = await client.messages.create({
    model: aiConfig.model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [INTENT_TOOL],
    tool_choice: { type: "tool", name: INTENT_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  return normalizeIntent(toolInputFromMessage(message));
}

/** Coerce raw model output into a valid OutfitIntent, dropping anything invalid. */
function normalizeIntent(raw: unknown): OutfitIntent {
  const data = (raw ?? {}) as Record<string, unknown>;

  const weather = WEATHER_VALUES.includes(data.weather as Weather)
    ? (data.weather as Weather)
    : undefined;
  const formality = FORMALITY_VALUES.includes(data.formality as Formality)
    ? (data.formality as Formality)
    : undefined;
  const occasion =
    typeof data.occasion === "string" && data.occasion.trim()
      ? data.occasion.trim().toLowerCase()
      : undefined;
  const descriptors = Array.isArray(data.descriptors)
    ? Array.from(
        new Set(
          data.descriptors
            .filter((d): d is string => typeof d === "string")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean),
        ),
      )
    : [];

  return {
    ...(occasion ? { occasion } : {}),
    ...(weather ? { weather } : {}),
    ...(formality ? { formality } : {}),
    descriptors,
  };
}

/** Deterministic keyword interpreter used when the provider is unavailable. */
function interpretWithKeywords(prompt: string): OutfitIntent {
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
