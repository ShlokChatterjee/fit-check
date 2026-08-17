import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    outfit: { findFirst: vi.fn() },
    feedback: { upsert: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

import { submitFeedback } from "./feedback";
import { OutfitNotFoundError } from "./types";

const outfit = prisma.outfit as unknown as Record<string, ReturnType<typeof vi.fn>>;
const feedback = prisma.feedback as unknown as Record<string, ReturnType<typeof vi.fn>>;

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
  });

  it("upserts a like scoped to the owned outfit", async () => {
    outfit.findFirst.mockResolvedValue({ id: "outfit-1" });

    const result = await submitFeedback("user-1", "outfit-1", true);

    // Ownership is checked before any write.
    expect(outfit.findFirst).toHaveBeenCalledWith({
      where: { id: "outfit-1", userId: "user-1" },
      select: { id: true },
    });
    // Upsert keys on the unique outfitId and carries the user + rating.
    expect(feedback.upsert).toHaveBeenCalledWith({
      where: { outfitId: "outfit-1" },
      create: { userId: "user-1", outfitId: "outfit-1", liked: true },
      update: { liked: true },
    });
    expect(result.liked).toBe(true);
  });

  it("records a dislike (liked=false) and can overwrite a prior rating", async () => {
    outfit.findFirst.mockResolvedValue({ id: "outfit-1" });

    await submitFeedback("user-1", "outfit-1", false);

    expect(feedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { outfitId: "outfit-1" },
        update: { liked: false },
      }),
    );
  });
});
