import {
  DetectionStatus,
  IngestStatus,
  type SourceType,
} from "@/app/generated/prisma/enums";
import type { IngestionEvent, WardrobeItem } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { analyzeClothing } from "@/lib/ai/analyze-clothing";
import { createItem } from "@/lib/wardrobe/service";

import { IngestionNotFoundError } from "./types";
import type { DetectionDecision, NewItemInput } from "./types";

// Ingestion pipeline (Features 3-5). Detections are predictions; nothing enters
// the wardrobe until the user confirms during review. The application — not the
// LLM — decides what is persisted.

export async function createIngestionEvent(
  userId: string,
  input: { source: SourceType; imageUrl: string },
): Promise<IngestionEvent> {
  return prisma.ingestionEvent.create({
    data: { userId, source: input.source, imageUrl: input.imageUrl },
  });
}

/** Run detection on the event's image and persist the predictions (Feature 4). */
export async function runDetection(eventId: string, imageUrl: string): Promise<void> {
  const detected = await analyzeClothing({ imageUrl });
  if (detected.length === 0) return;

  await prisma.detection.createMany({
    data: detected.map((d) => ({
      eventId,
      category: d.category,
      name: d.name,
      color: d.color ?? null,
      descriptors: d.descriptors,
      confidence: d.confidence,
      cropUrl: d.cropHint ?? null,
    })),
  });
}

/**
 * The user's oldest still-unreviewed ingestion event, excluding one id. Used to
 * chain review across a multi-photo Google Photos import so each event gets seen.
 */
export async function getNextPendingEventId(
  userId: string,
  excludeId?: string,
): Promise<string | null> {
  const next = await prisma.ingestionEvent.findFirst({
    where: {
      userId,
      status: IngestStatus.PENDING_REVIEW,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return next?.id ?? null;
}

export async function getIngestionEvent(userId: string, id: string) {
  return prisma.ingestionEvent.findFirst({
    where: { id, userId },
    include: { detections: { orderBy: { confidence: "desc" } } },
  });
}

async function requireOwnedEvent(userId: string, eventId: string) {
  const event = await prisma.ingestionEvent.findFirst({
    where: { id: eventId, userId },
    include: { detections: true },
  });
  if (!event) throw new IngestionNotFoundError();
  return event;
}

/**
 * Apply the user's review decisions (Feature 5). Confirmed detections become
 * wardrobe items; rejected ones are marked and never saved. Missed items the
 * user added are created too. Returns the newly created wardrobe items.
 */
export async function confirmDetections(
  userId: string,
  eventId: string,
  decisions: DetectionDecision[],
  newItems: NewItemInput[] = [],
): Promise<WardrobeItem[]> {
  const event = await requireOwnedEvent(userId, eventId);
  const byId = new Map(event.detections.map((d) => [d.id, d]));
  const created: WardrobeItem[] = [];

  for (const decision of decisions) {
    const detection = byId.get(decision.detectionId);
    if (!detection) continue; // ignore ids not belonging to this event

    if (decision.action === "reject") {
      await prisma.detection.update({
        where: { id: detection.id },
        data: { status: DetectionStatus.REJECTED },
      });
      continue;
    }

    const item = await createItem(userId, {
      category: decision.category ?? detection.category,
      name: decision.name ?? detection.name,
      color: decision.color !== undefined ? decision.color ?? undefined : detection.color ?? undefined,
      descriptors: decision.descriptors ?? detection.descriptors,
      imageUrl: event.imageUrl,
      cropUrl: detection.cropUrl ?? undefined,
    });
    created.push(item);

    await prisma.detection.update({
      where: { id: detection.id },
      data: { status: DetectionStatus.CONFIRMED, createdItemId: item.id },
    });
  }

  for (const newItem of newItems) {
    const item = await createItem(userId, {
      category: newItem.category,
      name: newItem.name,
      color: newItem.color ?? undefined,
      descriptors: newItem.descriptors ?? [],
      imageUrl: event.imageUrl,
    });
    created.push(item);
  }

  await prisma.ingestionEvent.update({
    where: { id: event.id },
    data: { status: IngestStatus.CONFIRMED },
  });

  return created;
}
