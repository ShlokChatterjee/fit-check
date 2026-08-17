"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SourceType } from "@/app/generated/prisma/enums";
import { requireUserId } from "@/lib/auth/guards";
import { saveUploadedImage } from "@/lib/storage/local";
import {
  confirmDetections,
  createIngestionEvent,
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

/** Apply review decisions (Feature 5) and return to the wardrobe. */
export async function confirmDetectionsAction(
  eventId: string,
  decisions: DetectionDecision[],
  newItems: NewItemInput[],
): Promise<void> {
  const userId = await requireUserId();
  await confirmDetections(userId, eventId, decisions, newItems);
  revalidatePath("/wardrobe");
  redirect("/wardrobe");
}
