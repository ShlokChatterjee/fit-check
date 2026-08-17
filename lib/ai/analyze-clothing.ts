import { readFile } from "node:fs/promises";
import path from "node:path";

import type Anthropic from "@anthropic-ai/sdk";

import { Category } from "@/app/generated/prisma/enums";

import {
  aiConfig,
  getAiClient,
  isAiConfigured,
  toolInputFromMessage,
} from "./provider";
import type { DetectedItem } from "./types";

export interface AnalyzeClothingInput {
  /** URL of the submitted image, or... */
  imageUrl?: string;
  /** ...raw bytes. One of the two must be provided. */
  imageBytes?: Uint8Array;
}

const CATEGORY_VALUES = Object.values(Category);

const MEDIA_TYPE_BY_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const SYSTEM_PROMPT = `You identify distinct clothing and accessory items visible in one image.
For each item, report its category, a short descriptive name, primary color, a few style
descriptors, and your confidence (0-1). Identify the type and attributes of items only —
never brands, never exact products. Report only items you can actually see; do not guess at
items that are not visible. You are making predictions for human review; you decide nothing.`;

const DETECTION_TOOL: Anthropic.Tool = {
  name: "record_detected_items",
  description: "Record every distinct clothing item detected in the image.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per distinct clothing item.",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: CATEGORY_VALUES },
            name: { type: "string", description: "Short descriptive name, e.g. 'Navy denim jacket'." },
            color: { type: "string", description: "Primary color." },
            descriptors: { type: "array", items: { type: "string" } },
            confidence: { type: "number", description: "Confidence in [0, 1]." },
          },
          required: ["category", "name", "descriptors", "confidence"],
        },
      },
    },
    required: ["items"],
  },
};

/**
 * Detect distinct clothing items in one image (Feature 4).
 *
 * Contract: interpretation only. Returns a prediction set — never persists,
 * never claims ownership. The application decides what (if anything) is saved,
 * after user review.
 *
 * Uses the configured vision-capable Claude model when a key is set; otherwise
 * (or on any provider error) returns a deterministic placeholder so the
 * ingestion pipeline stays runnable end-to-end.
 */
export async function analyzeClothing(
  input: AnalyzeClothingInput,
): Promise<DetectedItem[]> {
  if (!input.imageUrl && !input.imageBytes) {
    throw new Error("analyzeClothing requires imageUrl or imageBytes");
  }

  if (isAiConfigured()) {
    try {
      return await analyzeWithProvider(input);
    } catch (error) {
      console.error("analyzeClothing: provider call failed, using fallback", error);
    }
  }

  return stubDetections();
}

async function analyzeWithProvider(
  input: AnalyzeClothingInput,
): Promise<DetectedItem[]> {
  const source = await buildImageSource(input);
  const client = getAiClient();

  const message = await client.messages.create({
    model: aiConfig.model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [DETECTION_TOOL],
    tool_choice: { type: "tool", name: DETECTION_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          { type: "text", text: "Identify every clothing item you can see in this image." },
        ],
      },
    ],
  });

  return normalizeDetections(toolInputFromMessage(message));
}

/** Build a Claude image source from raw bytes, a local upload, or a remote URL. */
async function buildImageSource(
  input: AnalyzeClothingInput,
): Promise<Anthropic.ImageBlockParam["source"]> {
  if (input.imageBytes) {
    return {
      type: "base64",
      media_type: "image/jpeg",
      data: Buffer.from(input.imageBytes).toString("base64"),
    };
  }

  const url = input.imageUrl!;
  if (/^https?:\/\//i.test(url)) {
    return { type: "url", url };
  }

  // Local upload served from public/ (e.g. "/uploads/<name>.jpg").
  const relative = url.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = MEDIA_TYPE_BY_EXT[ext] ?? "image/jpeg";

  return { type: "base64", media_type: mediaType, data: bytes.toString("base64") };
}

/** Coerce raw model output into valid DetectedItem[], dropping malformed entries. */
function normalizeDetections(raw: unknown): DetectedItem[] {
  const data = (raw ?? {}) as { items?: unknown };
  if (!Array.isArray(data.items)) return [];

  const detected: DetectedItem[] = [];
  for (const entry of data.items) {
    const item = entry as Record<string, unknown>;
    if (!CATEGORY_VALUES.includes(item.category as Category)) continue;
    if (typeof item.name !== "string" || !item.name.trim()) continue;

    const confidence =
      typeof item.confidence === "number" ? clamp01(item.confidence) : 0.5;
    const descriptors = Array.isArray(item.descriptors)
      ? item.descriptors.filter((d): d is string => typeof d === "string")
      : [];

    detected.push({
      category: item.category as Category,
      name: item.name.trim(),
      ...(typeof item.color === "string" && item.color.trim()
        ? { color: item.color.trim() }
        : {}),
      descriptors,
      confidence,
    });
  }
  return detected;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function stubDetections(): DetectedItem[] {
  return [
    {
      category: Category.TOPS,
      name: "White T-shirt",
      color: "white",
      descriptors: ["cotton", "crew neck"],
      confidence: 0.9,
    },
    {
      category: Category.BOTTOMS,
      name: "Blue jeans",
      color: "blue",
      descriptors: ["denim", "slim"],
      confidence: 0.86,
    },
  ];
}
