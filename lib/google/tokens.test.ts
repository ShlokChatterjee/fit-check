import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

import { getGoogleAccessToken, GoogleAuthError } from "./tokens";

const account = prisma.account as unknown as Record<string, ReturnType<typeof vi.fn>>;
const nowSeconds = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  vi.clearAllMocks();
  account.update.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getGoogleAccessToken", () => {
  it("throws when no Google account is linked", async () => {
    account.findFirst.mockResolvedValue(null);
    await expect(getGoogleAccessToken("user-1")).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("returns the stored token while it is still valid", async () => {
    account.findFirst.mockResolvedValue({
      id: "acc-1",
      access_token: "valid-token",
      refresh_token: "r",
      expires_at: nowSeconds() + 3600,
    });

    const token = await getGoogleAccessToken("user-1");

    expect(token).toBe("valid-token");
    expect(fetch).not.toHaveBeenCalled();
    expect(account.update).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists the new one", async () => {
    account.findFirst.mockResolvedValue({
      id: "acc-1",
      access_token: "stale-token",
      refresh_token: "refresh-token",
      expires_at: nowSeconds() - 10,
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "fresh-token", expires_in: 3600 }),
    });

    const token = await getGoogleAccessToken("user-1");

    expect(token).toBe("fresh-token");
    expect(account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc-1" },
        data: expect.objectContaining({ access_token: "fresh-token" }),
      }),
    );
  });

  it("falls back to the stored token when there is nothing to refresh with", async () => {
    account.findFirst.mockResolvedValue({
      id: "acc-1",
      access_token: "only-token",
      refresh_token: null,
      expires_at: nowSeconds() - 10,
    });

    const token = await getGoogleAccessToken("user-1");

    expect(token).toBe("only-token");
    expect(fetch).not.toHaveBeenCalled();
  });
});
