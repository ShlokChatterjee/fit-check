import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceType } from "@/app/generated/prisma/enums";

vi.mock("@/lib/google/tokens", () => ({ getGoogleAccessToken: vi.fn() }));
vi.mock("@/lib/google/photos-picker", () => ({
  listPickedPhotos: vi.fn(),
  downloadPhotoBytes: vi.fn(),
}));
vi.mock("@/lib/storage/local", () => ({ saveImageBuffer: vi.fn() }));
vi.mock("./service", () => ({ createIngestionEvent: vi.fn(), runDetection: vi.fn() }));

import { getGoogleAccessToken } from "@/lib/google/tokens";
import { downloadPhotoBytes, listPickedPhotos } from "@/lib/google/photos-picker";
import { saveImageBuffer } from "@/lib/storage/local";

import { importPickedPhotos } from "./google-photos";
import { createIngestionEvent, runDetection } from "./service";

const tokenMock = getGoogleAccessToken as unknown as ReturnType<typeof vi.fn>;
const listMock = listPickedPhotos as unknown as ReturnType<typeof vi.fn>;
const downloadMock = downloadPhotoBytes as unknown as ReturnType<typeof vi.fn>;
const saveMock = saveImageBuffer as unknown as ReturnType<typeof vi.fn>;
const createEventMock = createIngestionEvent as unknown as ReturnType<typeof vi.fn>;
const runDetectionMock = runDetection as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  tokenMock.mockResolvedValue("token");
  downloadMock.mockResolvedValue(Buffer.from("bytes"));
  saveMock.mockImplementation((_bytes: Buffer, mime: string) =>
    Promise.resolve(`/uploads/x.${mime.includes("png") ? "png" : "jpg"}`),
  );
  runDetectionMock.mockResolvedValue(undefined);
  let n = 0;
  createEventMock.mockImplementation((_userId: string, input: { imageUrl: string }) =>
    Promise.resolve({ id: `event-${++n}`, imageUrl: input.imageUrl }),
  );
});

describe("importPickedPhotos", () => {
  it("imports each picked photo into its own event and runs detection", async () => {
    listMock.mockResolvedValue([
      { id: "p1", baseUrl: "https://b/1", mimeType: "image/jpeg", filename: "a.jpg" },
      { id: "p2", baseUrl: "https://b/2", mimeType: "image/png", filename: "b.png" },
    ]);

    const eventIds = await importPickedPhotos("user-1", "sess-1");

    expect(eventIds).toEqual(["event-1", "event-2"]);
    expect(downloadMock).toHaveBeenCalledTimes(2);
    // Every event is created as a Google Photos source and gets detection run.
    expect(createEventMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ source: SourceType.GOOGLE_PHOTOS }),
    );
    expect(runDetectionMock).toHaveBeenCalledTimes(2);
    expect(runDetectionMock).toHaveBeenCalledWith("event-1", "/uploads/x.jpg");
  });

  it("returns an empty list when nothing was picked", async () => {
    listMock.mockResolvedValue([]);

    const eventIds = await importPickedPhotos("user-1", "sess-1");

    expect(eventIds).toEqual([]);
    expect(createEventMock).not.toHaveBeenCalled();
  });
});
