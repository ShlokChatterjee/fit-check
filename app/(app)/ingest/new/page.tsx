import Link from "next/link";

import { GooglePhotosPicker } from "@/components/ingest/GooglePhotosPicker";
import { requireUser } from "@/lib/auth/guards";
import { uploadAndDetect } from "@/lib/ingestion/actions";

export default async function NewIngestionPage() {
  await requireUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link href="/wardrobe" className="text-sm text-black/60 hover:underline dark:text-white/60">
          ← Back to wardrobe
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add from a photo</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Upload a photo of your clothing. We&apos;ll detect the items so you can
          review and confirm them before they&apos;re added.
        </p>
      </div>

      <form action={uploadAndDetect} className="flex flex-col gap-4">
        <label htmlFor="image" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Photo</span>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            required
            className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:opacity-90"
          />
          <span className="text-xs text-black/50 dark:text-white/50">
            PNG, JPEG, WebP, or GIF · up to 10 MB
          </span>
        </label>

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Detect items
          </button>
          <Link
            href="/wardrobe"
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="flex items-center gap-3 text-xs text-black/40 dark:text-white/40">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        or
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">From Google Photos</span>
        <GooglePhotosPicker />
      </div>
    </div>
  );
}
