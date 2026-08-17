import { beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

// Mock the Prisma singleton so the service is tested in isolation.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wardrobeItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import * as service from "./service";
import { WardrobeNotFoundError, WardrobeValidationError } from "./types";

const db = prisma.wardrobeItem as unknown as Record<string, ReturnType<typeof vi.fn>>;

const sampleItem = {
  id: "item-1",
  userId: "user-1",
  category: Category.TOPS,
  name: "White T-shirt",
  color: "white",
  isFavorite: false,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listWardrobe", () => {
  it("scopes the query to the user and orders favorites first", async () => {
    db.findMany.mockResolvedValue([sampleItem]);
    await service.listWardrobe("user-1", { category: Category.TOPS });

    expect(db.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", category: Category.TOPS },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
    });
  });

  it("adds isActive filter only when activeOnly is set", async () => {
    db.findMany.mockResolvedValue([]);
    await service.listWardrobe("user-1", { activeOnly: true });
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", isActive: true } }),
    );
  });
});

describe("getItem", () => {
  it("looks up by id AND userId (ownership scoping)", async () => {
    db.findFirst.mockResolvedValue(sampleItem);
    await service.getItem("user-1", "item-1");
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "item-1", userId: "user-1" } });
  });
});

describe("createItem", () => {
  it("rejects a blank name", async () => {
    await expect(
      service.createItem("user-1", {
        category: Category.TOPS,
        name: "   ",
        imageUrl: "https://example.com/a.jpg",
      }),
    ).rejects.toBeInstanceOf(WardrobeValidationError);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid category", async () => {
    await expect(
      service.createItem("user-1", {
        // @ts-expect-error intentionally invalid
        category: "HATS",
        name: "Beanie",
        imageUrl: "https://example.com/a.jpg",
      }),
    ).rejects.toBeInstanceOf(WardrobeValidationError);
  });

  it("persists a valid item scoped to the owner", async () => {
    db.create.mockResolvedValue(sampleItem);
    await service.createItem("user-1", {
      category: Category.TOPS,
      name: "  White T-shirt ",
      color: " white ",
      imageUrl: " https://example.com/a.jpg ",
      descriptors: ["cotton"],
    });

    expect(db.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        category: Category.TOPS,
        name: "White T-shirt",
        color: "white",
        imageUrl: "https://example.com/a.jpg",
        descriptors: ["cotton"],
      }),
    });
  });
});

describe("updateItem", () => {
  it("throws NotFound when the item is not owned by the user", async () => {
    db.findFirst.mockResolvedValue(null);
    await expect(
      service.updateItem("user-1", "item-1", { name: "New" }),
    ).rejects.toBeInstanceOf(WardrobeNotFoundError);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates only provided fields when owned", async () => {
    db.findFirst.mockResolvedValue(sampleItem);
    db.update.mockResolvedValue({ ...sampleItem, name: "New name" });
    await service.updateItem("user-1", "item-1", { name: "New name" });
    expect(db.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { name: "New name" },
    });
  });
});

describe("toggleFavorite", () => {
  it("flips the current favorite flag", async () => {
    db.findFirst.mockResolvedValue({ ...sampleItem, isFavorite: false });
    db.update.mockResolvedValue({ ...sampleItem, isFavorite: true });
    await service.toggleFavorite("user-1", "item-1");
    expect(db.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { isFavorite: true },
    });
  });
});

describe("deleteItem", () => {
  it("verifies ownership before deleting", async () => {
    db.findFirst.mockResolvedValue(null);
    await expect(service.deleteItem("user-1", "item-1")).rejects.toBeInstanceOf(
      WardrobeNotFoundError,
    );
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe("checkDuplicates", () => {
  it("compares against the user's same-category items", async () => {
    db.findMany.mockResolvedValue([
      { ...sampleItem, id: "existing", name: "White T-shirt" },
    ]);
    const dupes = await service.checkDuplicates("user-1", {
      category: Category.TOPS,
      name: "white t shirt",
      color: "white",
    });
    expect(db.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", category: Category.TOPS },
    });
    expect(dupes.map((d) => d.id)).toEqual(["existing"]);
  });
});
