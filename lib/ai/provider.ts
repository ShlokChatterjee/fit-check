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
