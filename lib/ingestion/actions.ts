"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SourceType } from "@/app/generated/prisma/enums";
import { requireUserId } from "@/lib/auth/guards";
import { saveUploadedImage } from "@/lib/storage/local";
import {
  importPickedPhotos,
  isPickerSessionReady,
  startPickerSession,
} from "./google-photos";
import {
  confirmDetections,
  createIngestionEvent,
  getNextPendingEventId,
  runDetection,
} from "./service";
import type { DetectionDecision, NewItemInput } from "./types";

/** Device-upload ingestion (Feature 3, Method A) → detection (Feature 4). */
export async function uploadAndDetect(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    throw new Error("No image provided");
  }

  const imageUrl = await saveUploadedImage(file);
  const event = await createIngestionEvent(userId, {
    source: SourceType.DEVICE_UPLOAD,
    imageUrl,
  });
  await runDetection(event.id, imageUrl);

  redirect(`/ingest/${event.id}/review`);
}

/** Start a Google Photos picker session (Feature 3, Method B). */
export async function startGooglePhotosPickerAction(): Promise<{
  sessionId: string;
  pickerUri: string;
}> {
  const userId = await requireUserId();
  return startPickerSession(userId);
}

/** Poll whether the user has finished picking photos. */
export async function pollGooglePhotosPickerAction(sessionId: string): Promise<boolean> {
  const userId = await requireUserId();
  return isPickerSessionReady(userId, sessionId);
}

/** Import the picked photos into the detection pipeline and open the first review. */
export async function importGooglePhotosAction(sessionId: string): Promise<void> {
  const userId = await requireUserId();
  const eventIds = await importPickedPhotos(userId, sessionId);
  if (eventIds.length === 0) {
    throw new Error("No photos were selected");
  }
  revalidatePath("/wardrobe");
  redirect(`/ingest/${eventIds[0]}/review`);
}

/** Apply review decisions (Feature 5), then chain to the next unreviewed event. */
export async function confirmDetectionsAction(
  eventId: string,
  decisions: DetectionDecision[],
  newItems: NewItemInput[],
): Promise<void> {
  const userId = await requireUserId();
  await confirmDetections(userId, eventId, decisions, newItems);
  revalidatePath("/wardrobe");

  // A multi-photo Google Photos import creates several pending events — send the
  // user to the next one, or back to the wardrobe when none remain.
  const nextEventId = await getNextPendingEventId(userId, eventId);
  redirect(nextEventId ? `/ingest/${nextEventId}/review` : "/wardrobe");
}
