import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the heavy Auth.js module and Next navigation.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireUser, requireUserId, UnauthenticatedError } from "./guards";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUserId (for server actions)", () => {
  it("throws UnauthenticatedError when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("returns the user id when authenticated", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireUserId()).resolves.toBe("user-1");
  });
});

describe("requireUser (for pages)", () => {
  it("redirects to the landing page when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("returns the user id and does not redirect when authenticated", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireUser()).resolves.toBe("user-1");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
