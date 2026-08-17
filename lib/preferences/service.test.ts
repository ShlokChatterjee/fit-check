import { beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/app/generated/prisma/enums";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    preference: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

import { loadPreferences, recordOutfitFeedback, resetPreferences } from "./service";

const preference = prisma.preference as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  preference.upsert.mockResolvedValue({});
});

describe("loadPreferences", () => {
  it("returns an empty model when the user has no row", async () => {
    preference.findUnique.mockResolvedValue(null);
    expect(await loadPreferences("user-1")).toEqual({ colors: {}, categories: {}, pairings: {} });
  });

  it("normalizes a partial stored model", async () => {
    preference.findUnique.mockResolvedValue({ data: { colors: { navy: 2 } } });
    expect(await loadPreferences("user-1")).toEqual({
      colors: { navy: 2 },
      categories: {},
      pairings: {},
    });
  });
});

describe("recordOutfitFeedback", () => {
  it("folds the signal into the stored model, scoped to the user", async () => {
    preference.findUnique.mockResolvedValue(null);

    const next = await recordOutfitFeedback(
      "user-1",
      [{ id: "top-1", category: Category.TOPS, color: "Navy" }],
      "like",
    );

    expect(next.colors.navy).toBe(1);
    const call = preference.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-1" });
    expect(call.create.userId).toBe("user-1");
    expect(call.create.data.colors.navy).toBe(1);
    expect(call.update.data.colors.navy).toBe(1);
  });

  it("builds on the existing stored model", async () => {
    preference.findUnique.mockResolvedValue({ data: { colors: { navy: 1 }, categories: {}, pairings: {} } });

    const next = await recordOutfitFeedback(
      "user-1",
      [{ id: "top-1", category: Category.TOPS, color: "Navy" }],
      "like",
    );

    expect(next.colors.navy).toBe(2);
  });
});

describe("resetPreferences", () => {
  it("upserts an empty model", async () => {
    await resetPreferences("user-1");
    const call = preference.upsert.mock.calls[0][0];
    expect(call.create.data).toEqual({ colors: {}, categories: {}, pairings: {} });
    expect(call.update.data).toEqual({ colors: {}, categories: {}, pairings: {} });
  });
});
