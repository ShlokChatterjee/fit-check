"use client";

import Link from "next/link";
import { useTransition } from "react";

import type { WardrobeItem } from "@/app/generated/prisma/client";
import {
  deleteItemAction,
  setActiveAction,
  toggleFavoriteAction,
} from "@/lib/wardrobe/actions";
import { CATEGORY_LABELS } from "@/lib/wardrobe/labels";

export function WardrobeItemCard({ item }: { item: WardrobeItem }) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
    });
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-black/10 transition-opacity dark:border-white/15 ${
        item.isActive ? "" : "opacity-50"
      } ${isPending ? "pointer-events-none opacity-60" : ""}`}
    >
      <Link href={`/wardrobe/${item.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="aspect-square w-full bg-black/5 object-cover dark:bg-white/10"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/wardrobe/${item.id}`} className="font-medium hover:underline">
            {item.name}
          </Link>
          <button
            type="button"
            aria-label={item.isFavorite ? "Unfavorite" : "Favorite"}
            aria-pressed={item.isFavorite}
            onClick={() => run(() => toggleFavoriteAction(item.id))}
            className="text-lg leading-none"
          >
            {item.isFavorite ? "★" : "☆"}
          </button>
        </div>
        <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
          {CATEGORY_LABELS[item.category]}
          {item.color ? ` · ${item.color}` : ""}
        </span>

        <div className="mt-3 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => run(() => setActiveAction(item.id, !item.isActive))}
            className="text-black/60 hover:underline dark:text-white/60"
          >
            {item.isActive ? "Deactivate" : "Reactivate"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${item.name}"? This cannot be undone.`)) {
                run(() => deleteItemAction(item.id));
              }
            }}
            className="text-red-600 hover:underline dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
