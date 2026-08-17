import { SourceType } from "@/app/generated/prisma/enums";
import {
  createPickerSession,
  downloadPhotoBytes,
  getPickerSession,
  listPickedPhotos,
} from "@/lib/google/photos-picker";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { saveImageBuffer } from "@/lib/storage/local";

import { createIngestionEvent, runDetection } from "./service";

// Google Photos ingestion (Feature 3, Method B). Selected photos flow into the
// exact same IngestionEvent -> detection -> review pipeline as device uploads;
// the only difference is the source. The user picks photos explicitly in
// Google's picker — the app never scans their library.

/** Start a picker session; the returned URI is where the user selects photos. */
export async function startPickerSession(
  userId: string,
): Promise<{ sessionId: string; pickerUri: string }> {
  const token = await getGoogleAccessToken(userId);
  const session = await createPickerSession(token);
  return { sessionId: session.id, pickerUri: session.pickerUri };
}

/** Whether the user has finished selecting photos in the given session. */
export async function isPickerSessionReady(userId: string, sessionId: string): Promise<boolean> {
  const token = await getGoogleAccessToken(userId);
  const session = await getPickerSession(token, sessionId);
  return session.mediaItemsSet;
}

/**
 * Import every photo the user picked into its own ingestion event, running
 * detection on each. Returns the created event ids (in pick order).
 */
export async function importPickedPhotos(
  userId: string,
  sessionId: string,
): Promise<string[]> {
  const token = await getGoogleAccessToken(userId);
  const photos = await listPickedPhotos(token, sessionId);

  const eventIds: string[] = [];
  for (const photo of photos) {
    const bytes = await downloadPhotoBytes(token, photo);
    const imageUrl = await saveImageBuffer(bytes, photo.mimeType);
    const event = await createIngestionEvent(userId, {
      source: SourceType.GOOGLE_PHOTOS,
      imageUrl,
    });
    await runDetection(event.id, imageUrl);
    eventIds.push(event.id);
  }
  return eventIds;
}
