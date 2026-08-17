import { beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    outfit: { findFirst: vi.fn() },
    feedback: { upsert: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/preferences/service", () => ({ recordOutfitFeedback: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { recordOutfitFeedback } from "@/lib/preferences/service";

import { submitFeedback } from "./feedback";
import { OutfitNotFoundError } from "./types";

const outfit = prisma.outfit as unknown as Record<string, ReturnType<typeof vi.fn>>;
const feedback = prisma.feedback as unknown as Record<string, ReturnType<typeof vi.fn>>;
const recordFeedbackMock = recordOutfitFeedback as unknown as ReturnType<typeof vi.fn>;

// An owned outfit with two constituent items (as returned by the include).
const ownedOutfit = {
  id: "outfit-1",
  items: [
    { wardrobeItem: { id: "top-1", category: Category.TOPS, color: "navy" } },
    { wardrobeItem: { id: "shoes-1", category: Category.SHOES, color: "white" } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  feedback.upsert.mockImplementation(({ create }: { create: unknown }) =>
    Promise.resolve({ id: "fb-1", ...(create as object) }),
  );
});

describe("submitFeedback", () => {
  it("throws when the outfit is not owned by the user", async () => {
    outfit.findFirst.mockResolvedValue(null);
    await expect(submitFeedback("user-1", "outfit-x", true)).rejects.toBeInstanceOf(
      OutfitNotFoundError,
    );
    expect(feedback.upsert).not.toHaveBeenCalled();
    expect(recordFeedbackMock).not.toHaveBeenCalled();
  });

  it("upserts a like and folds it into the preference model", async () => {
    outfit.findFirst.mockResolvedValue(ownedOutfit);

    const result = await submitFeedback("user-1", "outfit-1", true);

    expect(feedback.upsert).toHaveBeenCalledWith({
      where: { outfitId: "outfit-1" },
      create: { userId: "user-1", outfitId: "outfit-1", liked: true },
      update: { liked: true },
    });
    // The constituent items are passed to preference learning with a "like".
    expect(recordFeedbackMock).toHaveBeenCalledWith(
      "user-1",
      [
        { id: "top-1", category: Category.TOPS, color: "navy" },
        { id: "shoes-1", category: Category.SHOES, color: "white" },
      ],
      "like",
    );
    expect(result.liked).toBe(true);
  });

  it("records a dislike as a penalizing signal", async () => {
    outfit.findFirst.mockResolvedValue(ownedOutfit);

    await submitFeedback("user-1", "outfit-1", false);

    expect(feedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { liked: false } }),
    );
    expect(recordFeedbackMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Array),
      "dislike",
    );
  });
});
