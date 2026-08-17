"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth/guards";
import { isCategory, WardrobeValidationError } from "./types";
import type { UpdateWardrobeItemInput } from "./types";
import * as service from "./service";

const WARDROBE_PATH = "/wardrobe";

export async function toggleFavoriteAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await service.toggleFavorite(userId, id);
  revalidatePath(WARDROBE_PATH);
}

export async function setActiveAction(id: string, isActive: boolean): Promise<void> {
  const userId = await requireUserId();
  await service.setActive(userId, id, isActive);
  revalidatePath(WARDROBE_PATH);
}

export async function deleteItemAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await service.deleteItem(userId, id);
  revalidatePath(WARDROBE_PATH);
}

export async function updateItemAction(
  id: string,
  patch: UpdateWardrobeItemInput,
): Promise<void> {
  const userId = await requireUserId();
  await service.updateItem(userId, id, patch);
  revalidatePath(WARDROBE_PATH);
  revalidatePath(`${WARDROBE_PATH}/${id}`);
}

/** Add-item form handler. Validates input, then redirects to the wardrobe. */
export async function createItemFromForm(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  const category = String(formData.get("category") ?? "");
  if (!isCategory(category)) {
    throw new WardrobeValidationError("invalid category");
  }

  const descriptorsRaw = String(formData.get("descriptors") ?? "").trim();
  const descriptors = descriptorsRaw
    ? descriptorsRaw.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

  await service.createItem(userId, {
    category,
    name: String(formData.get("name") ?? ""),
    color: optionalString(formData.get("color")),
    pattern: optionalString(formData.get("pattern")),
    material: optionalString(formData.get("material")),
    descriptors,
    imageUrl: String(formData.get("imageUrl") ?? ""),
  });

  revalidatePath(WARDROBE_PATH);
  redirect(WARDROBE_PATH);
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : undefined;
}
