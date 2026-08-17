import { Category } from "@/app/generated/prisma/enums";

export interface CreateWardrobeItemInput {
  category: Category;
  name: string;
  color?: string;
  pattern?: string;
  material?: string;
  descriptors?: string[];
  imageUrl: string;
  cropUrl?: string;
}

export interface UpdateWardrobeItemInput {
  category?: Category;
  name?: string;
  color?: string | null;
  pattern?: string | null;
  material?: string | null;
  descriptors?: string[];
}

export interface WardrobeFilter {
  category?: Category;
  /** When true, exclude deactivated items (used by outfit generation). */
  activeOnly?: boolean;
}

export class WardrobeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WardrobeValidationError";
  }
}

export class WardrobeNotFoundError extends Error {
  constructor() {
    super("Wardrobe item not found");
    this.name = "WardrobeNotFoundError";
  }
}

/** Runtime guard for the Category enum (generated as a const object in Prisma 7). */
export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (Object.values(Category) as string[]).includes(value)
  );
}
