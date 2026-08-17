import Anthropic from "@anthropic-ai/sdk";

// Provider configuration for the AI layer. The concrete provider client lives
// here so no route handler, server action, or component imports a provider SDK
// directly. Default model is a vision-capable Claude model, selected via config
// so it can be swapped without touching callers.

export const aiConfig = {
  model: process.env.AI_MODEL ?? "claude-opus-4-8",
  apiKey: process.env.AI_PROVIDER_API_KEY ?? "",
} as const;

/**
 * Whether a real provider is configured. When false, the AI functions run in
 * deterministic stub mode so the rest of the app is runnable without a key.
 */
export function isAiConfigured(): boolean {
  return aiConfig.apiKey.length > 0;
}

let client: Anthropic | null = null;

/**
 * Lazily construct the shared provider client. Callers must guard with
 * `isAiConfigured()` — this throws if no key is set, rather than issuing an
 * unauthenticated request.
 */
export function getAiClient(): Anthropic {
  if (!aiConfig.apiKey) {
    throw new Error("AI provider is not configured (AI_PROVIDER_API_KEY is unset)");
  }
  if (!client) {
    client = new Anthropic({ apiKey: aiConfig.apiKey });
  }
  return client;
}

/** Concatenate all text blocks from a Messages API response. */
export function textFromMessage(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/** Return the input of the first tool-use block, or throw if none is present. */
export function toolInputFromMessage(message: Anthropic.Message): unknown {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!block) {
    throw new Error("Expected a tool_use block in the model response");
  }
  return block.input;
}
