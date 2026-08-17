import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Local development image storage. Saves uploads under public/uploads so Next
// serves them at /uploads/<name>. In production this module is the seam to
// swap for blob storage (see Claude/implementation.md §11 BLOB_STORAGE_*).

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/** Persist an uploaded image and return its public URL path. */
export async function saveUploadedImage(file: File): Promise<string> {
  if (!file || file.size === 0) {
    throw new ImageUploadError("No image file provided");
  }
  if (file.size > MAX_BYTES) {
    throw new ImageUploadError("Image exceeds the 10 MB limit");
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    throw new ImageUploadError("Unsupported image type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return saveImageBuffer(bytes, file.type);
}

/**
 * Persist already-decoded image bytes (e.g. downloaded from Google Photos) and
 * return the public URL path. Unknown mime types fall back to a .jpg extension.
 */
export async function saveImageBuffer(bytes: Buffer, mimeType: string): Promise<string> {
  const ext = EXT_BY_TYPE[mimeType] ?? "jpg";
  const name = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);
  return `/uploads/${name}`;
}
