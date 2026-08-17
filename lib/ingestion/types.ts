import type { Category } from "@/app/generated/prisma/enums";

/** A user's decision about one detected item during review (Feature 5). */
export interface DetectionDecision {
  detectionId: string;
  action: "confirm" | "reject";
  // Optional edits applied on confirm (user can correct the AI prediction).
  category?: Category;
  name?: string;
  color?: string | null;
  descriptors?: string[];
}

/** An item the AI missed that the user adds manually during review. */
export interface NewItemInput {
  category: Category;
  name: string;
  color?: string | null;
  descriptors?: string[];
}

export class IngestionNotFoundError extends Error {
  constructor() {
    super("Ingestion event not found");
    this.name = "IngestionNotFoundError";
  }
}
