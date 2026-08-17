import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WardrobeItem } from "@/app/generated/prisma/client";
import { Category } from "@/app/generated/prisma/enums";

// Server actions and next/link are mocked so the client component renders alone.
vi.mock("@/lib/wardrobe/actions", () => ({
  toggleFavoriteAction: vi.fn().mockResolvedValue(undefined),
  setActiveAction: vi.fn().mockResolvedValue(undefined),
  deleteItemAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

import {
  deleteItemAction,
  setActiveAction,
  toggleFavoriteAction,
} from "@/lib/wardrobe/actions";
import { WardrobeItemCard } from "./WardrobeItemCard";

const item = {
  id: "item-1",
  userId: "user-1",
  category: Category.TOPS,
  name: "White T-shirt",
  color: "white",
  pattern: null,
  material: null,
  descriptors: [],
  imageUrl: "https://example.com/a.jpg",
  cropUrl: null,
  isFavorite: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as WardrobeItem;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WardrobeItemCard", () => {
  it("renders the item name and category", () => {
    render(<WardrobeItemCard item={item} />);
    expect(screen.getByText("White T-shirt")).toBeInTheDocument();
    expect(screen.getByText(/Tops/)).toBeInTheDocument();
  });

  it("toggles favorite via the server action", async () => {
    render(<WardrobeItemCard item={item} />);
    fireEvent.click(screen.getByRole("button", { name: /favorite/i }));
    await waitFor(() => expect(toggleFavoriteAction).toHaveBeenCalledWith("item-1"));
  });

  it("deactivates an active item with the correct flag", async () => {
    render(<WardrobeItemCard item={item} />);
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));
    await waitFor(() => expect(setActiveAction).toHaveBeenCalledWith("item-1", false));
  });

  it("deletes only after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WardrobeItemCard item={item} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(deleteItemAction).toHaveBeenCalledWith("item-1"));
  });

  it("does not delete when confirmation is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<WardrobeItemCard item={item} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(deleteItemAction).not.toHaveBeenCalled();
  });
});
