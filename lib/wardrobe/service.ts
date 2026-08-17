import type { WardrobeItem } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import { findLikelyDuplicates } from "./duplicates";
import {
  isCategory,
  WardrobeNotFoundError,
  WardrobeValidationError,
  type CreateWardrobeItemInput,
  type UpdateWardrobeItemInput,
  type WardrobeFilter,
} from "./types";

// Ownership-scoped wardrobe operations. Every function takes the authenticated
// userId and scopes its query by it — the application, not the LLM, is the
// source of truth for ownership (Claude/implementation.md §10).

export async function listWardrobe(
  userId: string,
  filter: WardrobeFilter = {},
): Promise<WardrobeItem[]> {
  return prisma.wardrobeItem.findMany({
    where: {
      userId,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
  });
}

export async function getItem(userId: string, id: string): Promise<WardrobeItem | null> {
  return prisma.wardrobeItem.findFirst({ where: { id, userId } });
}

async function requireOwned(userId: string, id: string): Promise<WardrobeItem> {
  const item = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!item) throw new WardrobeNotFoundError();
  return item;
}

export async function createItem(
  userId: string,
  input: CreateWardrobeItemInput,
): Promise<WardrobeItem> {
  const name = input.name?.trim();
  if (!name) throw new WardrobeValidationError("name is required");
  if (!input.imageUrl?.trim()) throw new WardrobeValidationError("imageUrl is required");
  if (!isCategory(input.category)) throw new WardrobeValidationError("invalid category");

  return prisma.wardrobeItem.create({
    data: {
      userId,
      category: input.category,
      name,
      color: input.color?.trim() || null,
      pattern: input.pattern?.trim() || null,
      material: input.material?.trim() || null,
      descriptors: input.descriptors ?? [],
      imageUrl: input.imageUrl.trim(),
      cropUrl: input.cropUrl?.trim() || null,
    },
  });
}

export async function updateItem(
  userId: string,
  id: string,
  patch: UpdateWardrobeItemInput,
): Promise<WardrobeItem> {
  await requireOwned(userId, id);
  if (patch.category !== undefined && !isCategory(patch.category)) {
    throw new WardrobeValidationError("invalid category");
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new WardrobeValidationError("name cannot be empty");
  }

  return prisma.wardrobeItem.update({
    where: { id },
    data: {
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.pattern !== undefined ? { pattern: patch.pattern } : {}),
      ...(patch.material !== undefined ? { material: patch.material } : {}),
      ...(patch.descriptors !== undefined ? { descriptors: patch.descriptors } : {}),
    },
  });
}

export async function toggleFavorite(userId: string, id: string): Promise<WardrobeItem> {
  const item = await requireOwned(userId, id);
  return prisma.wardrobeItem.update({
    where: { id },
    data: { isFavorite: !item.isFavorite },
  });
}

export async function setActive(
  userId: string,
  id: string,
  isActive: boolean,
): Promise<WardrobeItem> {
  await requireOwned(userId, id);
  return prisma.wardrobeItem.update({ where: { id }, data: { isActive } });
}

export async function deleteItem(userId: string, id: string): Promise<void> {
  await requireOwned(userId, id);
  await prisma.wardrobeItem.delete({ where: { id } });
}

/** Flag existing owned items that likely duplicate the candidate (Feature 5). */
export async function checkDuplicates(
  userId: string,
  candidate: { category: CreateWardrobeItemInput["category"]; name: string; color?: string | null },
): Promise<WardrobeItem[]> {
  const sameCategory = await prisma.wardrobeItem.findMany({
    where: { userId, category: candidate.category },
  });
  return findLikelyDuplicates(candidate, sameCategory);
}
