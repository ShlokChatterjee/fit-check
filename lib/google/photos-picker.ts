// Google Photos Picker API client (Feature 3, Method B). The Picker API only
// ever exposes items the user explicitly selects in Google's own picker UI — it
// never grants library-wide access. Provider-specific code stays isolated here;
// callers pass an access token (see ./tokens).
//
// Flow: create a session -> open session.pickerUri for the user -> poll the
// session until mediaItemsSet is true -> list the picked items -> download bytes.

const BASE_URL = "https://photospicker.googleapis.com/v1";

export interface PickerSession {
  id: string;
  pickerUri: string;
  /** True once the user has finished selecting in the picker. */
  mediaItemsSet: boolean;
  /** Server-suggested polling cadence, e.g. { pollInterval: "3s" }. */
  pollInterval?: string;
}

export interface PickedPhoto {
  id: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
}

export class PhotosPickerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PhotosPickerError";
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function toSession(data: Record<string, unknown>): PickerSession {
  const polling = data.pollingConfig as { pollInterval?: string } | undefined;
  return {
    id: String(data.id),
    pickerUri: String(data.pickerUri ?? ""),
    mediaItemsSet: Boolean(data.mediaItemsSet),
    pollInterval: polling?.pollInterval,
  };
}

/** Create a picker session and return the URI the user opens to select photos. */
export async function createPickerSession(token: string): Promise<PickerSession> {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new PhotosPickerError(`Failed to create picker session (${res.status})`, res.status);
  }
  return toSession(await res.json());
}

/** Fetch a session's current state (poll `mediaItemsSet` for completion). */
export async function getPickerSession(token: string, sessionId: string): Promise<PickerSession> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new PhotosPickerError(`Failed to read picker session (${res.status})`, res.status);
  }
  return toSession(await res.json());
}

/** List the photos the user picked in a completed session (image items only). */
export async function listPickedPhotos(token: string, sessionId: string): Promise<PickedPhoto[]> {
  const photos: PickedPhoto[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE_URL}/mediaItems`);
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) {
      throw new PhotosPickerError(`Failed to list picked photos (${res.status})`, res.status);
    }
    const data = (await res.json()) as {
      mediaItems?: Array<{
        id: string;
        type?: string;
        mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.mediaItems ?? []) {
      const file = item.mediaFile;
      if (!file?.baseUrl) continue;
      // Skip anything that isn't an image (e.g. picked videos).
      if (item.type && item.type !== "PHOTO") continue;
      if (file.mimeType && !file.mimeType.startsWith("image/")) continue;

      photos.push({
        id: item.id,
        baseUrl: file.baseUrl,
        mimeType: file.mimeType ?? "image/jpeg",
        filename: file.filename ?? "photo",
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return photos;
}

/** Download the original bytes of a picked photo (requires the access token). */
export async function downloadPhotoBytes(token: string, photo: PickedPhoto): Promise<Buffer> {
  // Appending "=d" to a Picker baseUrl requests the original, full-size bytes.
  const res = await fetch(`${photo.baseUrl}=d`, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new PhotosPickerError(`Failed to download photo (${res.status})`, res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}
