import { Category } from "@/app/generated/prisma/enums";

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.TOPS]: "Tops",
  [Category.BOTTOMS]: "Bottoms",
  [Category.SHOES]: "Shoes",
  [Category.OUTERWEAR]: "Outerwear",
  [Category.ACCESSORIES]: "Accessories",
};

/** Ordered category list for filters and forms. */
export const CATEGORIES: Category[] = [
  Category.TOPS,
  Category.BOTTOMS,
  Category.SHOES,
  Category.OUTERWEAR,
  Category.ACCESSORIES,
];
