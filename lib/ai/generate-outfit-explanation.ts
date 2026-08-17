import type { OutfitForExplanation } from "./types";

/**
 * Produce a short, human-readable explanation of why an outfit works
 * (Feature 6). The candidate set is supplied by application code; this function
 * only phrases the result. It introduces no items and enforces nothing.
 *
 * STUB: a deterministic template stands in until AI_PROVIDER_API_KEY is set.
 */
export async function generateOutfitExplanation(
  outfit: OutfitForExplanation,
): Promise<string> {
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
