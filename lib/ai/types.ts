import type { Category } from "@/app/generated/prisma/client";

// Shared types for the AI abstraction. Callers depend on these types, never on
// a provider SDK. AI functions return plain typed data — never DB writes, never
// ownership decisions (see Claude/implementation.md §1, §5).

/** A single clothing item predicted from an image. A prediction, not a wardrobe write. */
export interface DetectedItem {
  category: Category;
  name: string;
  color?: string;
  descriptors: string[];
  /** Model confidence in [0, 1]; the UI surfaces this during review. */
  confidence: number;
  /** Optional hint the app can use to crop the item from the source image. */
  cropHint?: string;
}

export type Formality = "casual" | "smart_casual" | "formal";
export type Weather = "hot" | "warm" | "mild" | "cold" | "wet";

/** Structured intent interpreted from a natural-language outfit request. */
export interface OutfitIntent {
  occasion?: string;
  weather?: Weather;
  formality?: Formality;
  descriptors: string[];
}

/** Minimal outfit shape passed to the explanation generator. */
export interface OutfitForExplanation {
  request?: string;
  intent: OutfitIntent;
  items: Array<{ category: Category; name: string; color?: string }>;
}
