import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  Category,
  DetectionStatus,
  IngestStatus,
} from "@/app/generated/prisma/enums";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ingestionEvent: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    detection: { createMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/ai/analyze-clothing", () => ({ analyzeClothing: vi.fn() }));
vi.mock("@/lib/wardrobe/service", () => ({ createItem: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { analyzeClothing } from "@/lib/ai/analyze-clothing";
import { createItem } from "@/lib/wardrobe/service";
import { confirmDetections, runDetection } from "./service";
import { IngestionNotFoundError } from "./types";

const events = prisma.ingestionEvent as unknown as Record<string, ReturnType<typeof vi.fn>>;
const detections = prisma.detection as unknown as Record<string, ReturnType<typeof vi.fn>>;
const analyzeMock = analyzeClothing as unknown as ReturnType<typeof vi.fn>;
const createItemMock = createItem as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  createItemMock.mockImplementation((_userId: string, input: { name: string }) =>
    Promise.resolve({ id: `item-${input.name}`, ...input }),
  );
});

describe("runDetection", () => {
  it("persists detected items as predictions", async () => {
    analyzeMock.mockResolvedValue([
      { category: Category.TOPS, name: "White T-shirt", color: "white", descriptors: ["cotton"], confidence: 0.9 },
    ]);
    await runDetection("event-1", "/uploads/a.jpg");
    expect(detections.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventId: "event-1",
          category: Category.TOPS,
          name: "White T-shirt",
          confidence: 0.9,
        }),
      ],
    });
  });

  it("skips the write when nothing is detected", async () => {
    analyzeMock.mockResolvedValue([]);
    await runDetection("event-1", "/uploads/a.jpg");
    expect(detections.createMany).not.toHaveBeenCalled();
  });
});

describe("confirmDetections", () => {
  const ownedEvent = {
    id: "event-1",
    userId: "user-1",
    imageUrl: "/uploads/a.jpg",
    detections: [
      { id: "d1", category: Category.TOPS, name: "White T-shirt", color: "white", descriptors: ["cotton"], cropUrl: null, status: DetectionStatus.PENDING },
      { id: "d2", category: Category.BOTTOMS, name: "Jeans", color: "blue", descriptors: [], cropUrl: null, status: DetectionStatus.PENDING },
    ],
  };

  it("throws when the event is not owned by the user", async () => {
    events.findFirst.mockResolvedValue(null);
    await expect(
      confirmDetections("user-1", "event-1", [], []),
    ).rejects.toBeInstanceOf(IngestionNotFoundError);
  });

  it("confirms included items, rejects excluded ones, and marks the event confirmed", async () => {
    events.findFirst.mockResolvedValue(ownedEvent);

    const created = await confirmDetections(
      "user-1",
      "event-1",
      [
        { detectionId: "d1", action: "confirm", category: Category.TOPS, name: "White tee", color: "white", descriptors: ["cotton"] },
        { detectionId: "d2", action: "reject" },
      ],
      [{ category: Category.SHOES, name: "Sneakers", color: "white", descriptors: [] }],
    );

    // Confirmed detection becomes a wardrobe item, using the event's image.
    expect(createItemMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "White tee", imageUrl: "/uploads/a.jpg" }),
    );
    expect(detections.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { status: DetectionStatus.CONFIRMED, createdItemId: "item-White tee" },
    });
    // Rejected detection is marked, never saved.
    expect(detections.update).toHaveBeenCalledWith({
      where: { id: "d2" },
      data: { status: DetectionStatus.REJECTED },
    });
    // Missed item added.
    expect(createItemMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Sneakers" }),
    );
    // Event closed out.
    expect(events.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: IngestStatus.CONFIRMED },
    });
    expect(created).toHaveLength(2);
  });

  it("ignores decisions for detections outside the event", async () => {
    events.findFirst.mockResolvedValue(ownedEvent);
    await confirmDetections(
      "user-1",
      "event-1",
      [{ detectionId: "not-in-event", action: "confirm", name: "Ghost" }],
      [],
    );
    expect(createItemMock).not.toHaveBeenCalled();
  });
});
