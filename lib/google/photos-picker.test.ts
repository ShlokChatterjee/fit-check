import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPickerSession, listPickedPhotos } from "./photos-picker";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fetchMock = () => fetch as unknown as ReturnType<typeof vi.fn>;

describe("createPickerSession", () => {
  it("returns the session id and picker uri", async () => {
    fetchMock().mockResolvedValue(
      jsonResponse({ id: "sess-1", pickerUri: "https://photos/pick", mediaItemsSet: false }),
    );

    const session = await createPickerSession("token");

    expect(session).toMatchObject({ id: "sess-1", pickerUri: "https://photos/pick", mediaItemsSet: false });
  });
});

describe("listPickedPhotos", () => {
  it("keeps only image items and paginates through all pages", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        jsonResponse({
          mediaItems: [
            { id: "p1", type: "PHOTO", mediaFile: { baseUrl: "https://b/1", mimeType: "image/jpeg", filename: "a.jpg" } },
            { id: "v1", type: "VIDEO", mediaFile: { baseUrl: "https://b/v", mimeType: "video/mp4", filename: "v.mp4" } },
          ],
          nextPageToken: "page-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          mediaItems: [
            { id: "p2", type: "PHOTO", mediaFile: { baseUrl: "https://b/2", mimeType: "image/png", filename: "b.png" } },
            { id: "x", mediaFile: {} }, // no baseUrl → skipped
          ],
        }),
      );

    const photos = await listPickedPhotos("token", "sess-1");

    expect(photos.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    // Second call carries the page token.
    const secondUrl = String(fetchMock().mock.calls[1][0]);
    expect(secondUrl).toContain("pageToken=page-2");
  });

  it("throws on a non-OK response", async () => {
    fetchMock().mockResolvedValue(jsonResponse({}, false, 403));
    await expect(listPickedPhotos("token", "sess-1")).rejects.toThrow();
  });
});
