import { beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";
import { makeItem } from "@/lib/outfits/test-utils";

vi.mock("@/lib/wardrobe/service", () => ({ listWardrobe: vi.fn() }));

import { listWardrobe } from "@/lib/wardrobe/service";

import { getGapSuggestions } from "./service";

const listWardrobeMock = listWardrobe as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("getGapSuggestions", () => {
  it("requires the baseline before analyzing (needs_basics)", async () => {
    // No shoes → below the generation baseline.
    listWardrobeMock.mockResolvedValue([
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.BOTTOMS }),
    ]);

    const result = await getGapSuggestions("user-1");

    expect(result).toEqual({ status: "needs_basics", missingSlots: [Category.SHOES] });
    // Analysis loads only active items.
    expect(listWardrobeMock).toHaveBeenCalledWith("user-1", { activeOnly: true });
  });

  it("returns grounded suggestions once the baseline is met", async () => {
    listWardrobeMock.mockResolvedValue([
      makeItem({ category: Category.TOPS }),
      makeItem({ category: Category.BOTTOMS }),
      makeItem({ category: Category.BOTTOMS }),
      makeItem({ category: Category.SHOES }),
      makeItem({ category: Category.SHOES }),
    ]);

    const result = await getGapSuggestions("user-1");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // 1 top vs 2 bottoms/2 shoes → a top is the top suggestion.
    expect(result.suggestions[0].category).toBe(Category.TOPS);
    expect(result.suggestions[0].addedOutfits).toBe(4);
  });
});
