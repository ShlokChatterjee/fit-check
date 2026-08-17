"use client";

import { useState, useTransition } from "react";

import type { Category } from "@/app/generated/prisma/client";
import { confirmDetectionsAction } from "@/lib/ingestion/actions";
import type { DetectionDecision, NewItemInput } from "@/lib/ingestion/types";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/wardrobe/labels";

interface DetectionView {
  id: string;
  category: Category;
  name: string;
  color: string | null;
  descriptors: string[];
  confidence: number;
  duplicateNames: string[];
}

interface EditableRow {
  included: boolean;
  name: string;
  category: Category;
  color: string;
  descriptors: string;
}

interface NewRow {
  key: string;
  name: string;
  category: Category;
  color: string;
  descriptors: string;
}

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20";

function parseDescriptors(value: string): string[] {
  return value.split(",").map((d) => d.trim()).filter(Boolean);
}

export function DetectionReview({
  eventId,
  detections,
}: {
  eventId: string;
  detections: DetectionView[];
}) {
  const [rows, setRows] = useState<Record<string, EditableRow>>(() =>
    Object.fromEntries(
      detections.map((d) => [
        d.id,
        {
          included: true,
          name: d.name,
          category: d.category,
          color: d.color ?? "",
          descriptors: d.descriptors.join(", "),
        },
      ]),
    ),
  );
  const [newItems, setNewItems] = useState<NewRow[]>([]);
  const [isPending, startTransition] = useTransition();

  function patchRow(id: string, patch: Partial<EditableRow>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function addNewItem() {
    setNewItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), name: "", category: CATEGORIES[0], color: "", descriptors: "" },
    ]);
  }

  function patchNewItem(key: string, patch: Partial<NewRow>) {
    setNewItems((prev) => prev.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  }

  function removeNewItem(key: string) {
    setNewItems((prev) => prev.filter((n) => n.key !== key));
  }

  function submit() {
    const decisions: DetectionDecision[] = detections.map((d) => {
      const row = rows[d.id];
      if (!row.included) {
        return { detectionId: d.id, action: "reject" };
      }
      return {
        detectionId: d.id,
        action: "confirm",
        category: row.category,
        name: row.name,
        color: row.color.trim() || null,
        descriptors: parseDescriptors(row.descriptors),
      };
    });

    const additions: NewItemInput[] = newItems
      .filter((n) => n.name.trim().length > 0)
      .map((n) => ({
        category: n.category,
        name: n.name.trim(),
        color: n.color.trim() || null,
        descriptors: parseDescriptors(n.descriptors),
      }));

    startTransition(async () => {
      await confirmDetectionsAction(eventId, decisions, additions);
    });
  }

  const confirmCount = detections.filter((d) => rows[d.id].included).length + newItems.filter((n) => n.name.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      {detections.map((d) => {
        const row = rows[d.id];
        return (
          <div
            key={d.id}
            className={`rounded-xl border border-black/10 p-4 dark:border-white/15 ${
              row.included ? "" : "opacity-50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) => patchRow(d.id, { included: e.target.checked })}
                />
                Include this item
              </label>
              <span className="text-xs text-black/50 dark:text-white/50">
                {Math.round(d.confidence * 100)}% confidence
              </span>
            </div>

            {d.duplicateNames.length > 0 ? (
              <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                Possible duplicate of: {d.duplicateNames.join(", ")}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Name
                <input
                  className={inputClass}
                  value={row.name}
                  onChange={(e) => patchRow(d.id, { name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Category
                <select
                  className={inputClass}
                  value={row.category}
                  onChange={(e) => patchRow(d.id, { category: e.target.value as Category })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Color
                <input
                  className={inputClass}
                  value={row.color}
                  onChange={(e) => patchRow(d.id, { color: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Descriptors
                <input
                  className={inputClass}
                  value={row.descriptors}
                  onChange={(e) => patchRow(d.id, { descriptors: e.target.value })}
                />
              </label>
            </div>
          </div>
        );
      })}

      {newItems.map((n) => (
        <div key={n.key} className="rounded-xl border border-dashed border-black/15 p-4 dark:border-white/20">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Added item</span>
            <button
              type="button"
              onClick={() => removeNewItem(n.key)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Name
              <input
                className={inputClass}
                value={n.name}
                onChange={(e) => patchNewItem(n.key, { name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <select
                className={inputClass}
                value={n.category}
                onChange={(e) => patchNewItem(n.key, { category: e.target.value as Category })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Color
              <input
                className={inputClass}
                value={n.color}
                onChange={(e) => patchNewItem(n.key, { color: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Descriptors
              <input
                className={inputClass}
                value={n.descriptors}
                onChange={(e) => patchNewItem(n.key, { descriptors: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addNewItem}
          className="rounded-full border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          + Add a missed item
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || confirmCount === 0}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Saving…" : `Confirm ${confirmCount} item${confirmCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
