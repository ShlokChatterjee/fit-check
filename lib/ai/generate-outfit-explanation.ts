import { aiConfig, getAiClient, isAiConfigured, textFromMessage } from "./provider";
import type { OutfitForExplanation } from "./types";

const SYSTEM_PROMPT = `You write a single short sentence explaining why an outfit works for the request.
Ground the explanation in the exact items provided — refer to them naturally.
Never invent or suggest an item that is not in the list. Never mention buying anything.
Keep it to one friendly sentence, under 30 words, with no preamble.`;

/**
 * Produce a short, human-readable explanation of why an outfit works
 * (Feature 6). The candidate set is supplied by application code; this function
 * only phrases the result. It introduces no items and enforces nothing.
 *
 * Uses the configured Claude model when a key is set; otherwise (or on any
 * provider error) falls back to a deterministic template.
 */
export async function generateOutfitExplanation(
  outfit: OutfitForExplanation,
): Promise<string> {
  if (isAiConfigured()) {
    try {
      const explanation = await explainWithProvider(outfit);
      if (explanation) return explanation;
    } catch (error) {
      console.error(
        "generateOutfitExplanation: provider call failed, using fallback",
        error,
      );
    }
  }
  return explainWithTemplate(outfit);
}

async function explainWithProvider(outfit: OutfitForExplanation): Promise<string> {
  const client = getAiClient();
  const items = outfit.items
    .map((i) => `- ${i.name}${i.color ? ` (${i.color})` : ""} [${i.category.toLowerCase()}]`)
    .join("\n");

  const intentParts: string[] = [];
  if (outfit.intent.occasion) intentParts.push(`occasion: ${outfit.intent.occasion}`);
  if (outfit.intent.formality) intentParts.push(`formality: ${outfit.intent.formality}`);
  if (outfit.intent.weather) intentParts.push(`weather: ${outfit.intent.weather}`);
  if (outfit.intent.descriptors.length) {
    intentParts.push(`style: ${outfit.intent.descriptors.join(", ")}`);
  }

  const userContent = [
    outfit.request ? `Request: "${outfit.request}"` : null,
    intentParts.length ? `Interpreted intent — ${intentParts.join("; ")}` : null,
    `Outfit items (the only items that exist):\n${items}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const message = await client.messages.create({
    model: aiConfig.model,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  return textFromMessage(message);
}

/** Deterministic template used when the provider is unavailable. */
function explainWithTemplate(outfit: OutfitForExplanation): string {
  const names = outfit.items.map((i) => i.name.toLowerCase());
  const list = joinWithAnd(names);

  const context: string[] = [];
  if (outfit.intent.occasion) context.push(`for ${outfit.intent.occasion}`);
  if (outfit.intent.formality) context.push(`${outfit.intent.formality.replace("_", " ")} in feel`);
  if (outfit.intent.weather) context.push(`suited to ${outfit.intent.weather} weather`);

  const suffix = context.length > 0 ? ` — ${joinWithAnd(context)}` : "";
  return `Pairs ${list} into one look${suffix}, built from items you already own.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "these pieces";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
