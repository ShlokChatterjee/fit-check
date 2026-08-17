import Link from "next/link";
import { notFound } from "next/navigation";

import { DetectionStatus } from "@/app/generated/prisma/enums";
import { DetectionReview } from "@/components/ingest/DetectionReview";
import { requireUser } from "@/lib/auth/guards";
import { getIngestionEvent } from "@/lib/ingestion/service";
import { checkDuplicates } from "@/lib/wardrobe/service";

export default async function ReviewPage({ params }: PageProps<"/ingest/[id]/review">) {
  const userId = await requireUser();
  const { id } = await params;
  const event = await getIngestionEvent(userId, id);
  if (!event) notFound();

  const pending = event.detections.filter((d) => d.status === DetectionStatus.PENDING);

  // Flag likely duplicates against the existing wardrobe (application logic).
  const detections = await Promise.all(
    pending.map(async (d) => {
      const dupes = await checkDuplicates(userId, {
        category: d.category,
        name: d.name,
        color: d.color,
      });
      return {
        id: d.id,
        category: d.category,
        name: d.name,
        color: d.color,
        descriptors: d.descriptors,
        confidence: d.confidence,
        duplicateNames: dupes.map((x) => x.name),
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/wardrobe" className="text-sm text-black/60 hover:underline dark:text-white/60">
          ← Back to wardrobe
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          We found {detections.length} item{detections.length === 1 ? "" : "s"}
        </h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Review the detected items. Confirm, edit, or remove each one before it
          joins your wardrobe.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt="Uploaded photo"
            className="w-full rounded-xl bg-black/5 object-cover dark:bg-white/10"
          />
        </div>

        {detections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
            Nothing left to review for this photo.{" "}
            <Link href="/wardrobe" className="underline">
              Back to wardrobe
            </Link>
            .
          </p>
        ) : (
          <DetectionReview eventId={event.id} detections={detections} />
        )}
      </div>
    </div>
  );
}
