import { beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    outfit: { create: vi.fn(), findFirst: vi.fn() },
    preference: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/wardrobe/service", () => ({ listWardrobe: vi.fn() }));
vi.mock("@/lib/ai/interpret-request", () => ({ interpretRequest: vi.fn() }));
vi.mock("@/lib/ai/generate-outfit-explanation", () => ({
  generateOutfitExplanation: vi.fn(),
}));
vi.mock("@/lib/preferences/service", () => ({
  loadPreferences: vi.fn().mockResolvedValue({ colors: {}, categories: {}, pairings: {} }),
  recordOutfitFeedback: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db/prisma";
import { listWardrobe } from "@/lib/wardrobe/service";
import { interpretRequest } from "@/lib/ai/interpret-request";
import { generateOutfitExplanation } from "@/lib/ai/generate-outfit-explanation";
import { recordOutfitFeedback } from "@/lib/preferences/service";

import { generateOutfit, showAnotherOutfit } from "./service";
import { OutfitNotFoundError, type StoredOutfitContext } from "./types";
import { makeItem } from "./test-utils";

const outfit = prisma.outfit as unknown as Record<string, ReturnType<typeof vi.fn>>;
const preference = prisma.preference as unknown as Record<string, ReturnType<typeof vi.fn>>;
const listWardrobeMock = listWardrobe as unknown as ReturnType<typeof vi.fn>;
const interpretMock = interpretRequest as unknown as ReturnType<typeof vi.fn>;
const explanationMock = generateOutfitExplanation as unknown as ReturnType<typeof vi.fn>;
const recordFeedbackMock = recordOutfitFeedback as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  interpretMock.mockResolvedValue({ descriptors: [] });
  explanationMock.mockResolvedValue("A tidy look built from what you own.");
  preference.findUnique.mockResolvedValue(null);
  outfit.create.mockResolvedValue({ id: "outfit-1" });
});

function fullWardrobe() {
  return [
    makeItem({ id: "top-1", category: Category.TOPS }),
    makeItem({ id: "top-2", category: Category.TOPS }),
    makeItem({ id: "bottom-1", category: Category.BOTTOMS }),
    makeItem({ id: "shoes-1", category: Category.SHOES }),
  ];
}

describe("generateOutfit", () => {
  it("returns needs_basics when a required slot is uncovered", async () => {
    listWardrobeMock.mockResolvedValue([
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.BOTTOMS }),
    ]);

    const result = await generateOutfit("user-1", "something for brunch");

    expect(result).toEqual({ status: "needs_basics", missingSlots: [Category.SHOES] });
    expect(outfit.create).not.toHaveBeenCalled();
  });

  it("serves and persists the top candidate when the baseline is met", async () => {
    listWardrobeMock.mockResolvedValue(fullWardrobe());

    const result = await generateOutfit("user-1", "casual weekend");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    // Only active items are loaded for generation.
    expect(listWardrobeMock).toHaveBeenCalledWith("user-1", { activeOnly: true });
    // Persisted with concrete item references, never free text.
    const createArg = outfit.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe("user-1");
    expect(createArg.data.items.create).toHaveLength(3);
    expect(createArg.data.explanation).toBe("A tidy look built from what you own.");
    // Two tops → two candidates, so another is available.
    expect(createArg.data.context.candidates).toHaveLength(2);
    expect(createArg.data.context.cursor).toBe(0);

    expect(result.outfit.outfitId).toBe("outfit-1");
    expect(result.outfit.items).toHaveLength(3);
    expect(result.outfit.hasMore).toBe(true);
  });
});

describe("showAnotherOutfit", () => {
  const storedContext: StoredOutfitContext = {
    intent: { descriptors: [] },
    cursor: 0,
    candidates: [
      {
        score: 2,
        items: [
          { slot: Category.TOPS, wardrobeItemId: "top-1" },
          { slot: Category.BOTTOMS, wardrobeItemId: "bottom-1" },
          { slot: Category.SHOES, wardrobeItemId: "shoes-1" },
        ],
      },
      {
        score: 1,
        items: [
          { slot: Category.TOPS, wardrobeItemId: "top-2" },
          { slot: Category.BOTTOMS, wardrobeItemId: "bottom-1" },
          { slot: Category.SHOES, wardrobeItemId: "shoes-1" },
        ],
      },
    ],
  };

  it("throws when the outfit is not owned by the user", async () => {
    outfit.findFirst.mockResolvedValue(null);
    await expect(showAnotherOutfit("user-1", "missing")).rejects.toBeInstanceOf(
      OutfitNotFoundError,
    );
  });

  it("advances to the next-ranked candidate", async () => {
    outfit.findFirst.mockResolvedValue({
      id: "outfit-1",
      userId: "user-1",
      request: "casual weekend",
      context: storedContext,
    });
    listWardrobeMock.mockResolvedValue(fullWardrobe());
    outfit.create.mockResolvedValue({ id: "outfit-2" });

    const result = await showAnotherOutfit("user-1", "outfit-1");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // Advanced candidate uses the second top and is the last one.
    expect(result.outfit.items.some((i) => i.wardrobeItemId === "top-2")).toBe(true);
    expect(result.outfit.hasMore).toBe(false);
    expect(outfit.create.mock.calls[0][0].data.context.cursor).toBe(1);
    // Skipping the current candidate records a soft-negative signal.
    expect(recordFeedbackMock).toHaveBeenCalledWith("user-1", expect.any(Array), "skip");
  });

  it("returns no_more when the cursor is at the last candidate", async () => {
    outfit.findFirst.mockResolvedValue({
      id: "outfit-1",
      userId: "user-1",
      request: "casual weekend",
      context: { ...storedContext, cursor: 1 },
    });
    listWardrobeMock.mockResolvedValue(fullWardrobe());

    const result = await showAnotherOutfit("user-1", "outfit-1");

    expect(result).toEqual({ status: "no_more" });
    expect(outfit.create).not.toHaveBeenCalled();
  });

  it("skips candidates whose items are no longer active", async () => {
    outfit.findFirst.mockResolvedValue({
      id: "outfit-1",
      userId: "user-1",
      request: "casual weekend",
      context: storedContext,
    });
    // top-2 has since been deactivated/deleted → not returned by activeOnly load.
    listWardrobeMock.mockResolvedValue([
      makeItem({ id: "top-1", category: Category.TOPS }),
      makeItem({ id: "bottom-1", category: Category.BOTTOMS }),
      makeItem({ id: "shoes-1", category: Category.SHOES }),
    ]);

    const result = await showAnotherOutfit("user-1", "outfit-1");

    // The only remaining candidate (index 1) references missing top-2 → no_more.
    expect(result).toEqual({ status: "no_more" });
  });
});
