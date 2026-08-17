"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { Category } from "@/app/generated/prisma/client";
import {
  generateOutfitAction,
  showAnotherOutfitAction,
} from "@/lib/outfits/actions";
import type { ServedOutfit } from "@/lib/outfits/types";
import { CATEGORY_LABELS } from "@/lib/wardrobe/labels";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20";

type ViewState =
  | { kind: "idle" }
  | { kind: "outfit"; outfit: ServedOutfit }
  | { kind: "needs_basics"; missingSlots: Category[] }
  | { kind: "no_more"; outfit: ServedOutfit };

export function OutfitGenerator({ baselineOk }: { baselineOk: boolean }) {
  const [request, setRequest] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function generate() {
    if (!request.trim()) return;
    startTransition(async () => {
      const result = await generateOutfitAction(request);
      if (result.status === "ok") {
        setView({ kind: "outfit", outfit: result.outfit });
      } else {
        setView({ kind: "needs_basics", missingSlots: result.missingSlots });
      }
    });
  }

  function showAnother(previousOutfitId: string) {
    startTransition(async () => {
      const result = await showAnotherOutfitAction(previousOutfitId);
      if (result.status === "ok") {
        setView({ kind: "outfit", outfit: result.outfit });
      } else if (view.kind === "outfit") {
        // Keep the current outfit on screen; just mark that none remain.
        setView({ kind: "no_more", outfit: view.outfit });
      }
    });
  }

  const currentOutfit =
    view.kind === "outfit" || view.kind === "no_more" ? view.outfit : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Describe the occasion</span>
          <input
            className={inputClass}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="something for a rainy work day"
            disabled={!baselineOk}
          />
        </label>
        <div>
          <button
            type="submit"
            disabled={!baselineOk || isPending || !request.trim()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending && !currentOutfit ? "Building…" : "Generate outfit"}
          </button>
        </div>
      </form>

      {!baselineOk ? (
        <NeedsBasics
          missingSlots={null}
          message="Add at least one top, one bottom, and one pair of shoes before generating an outfit."
        />
      ) : null}

      {view.kind === "needs_basics" ? (
        <NeedsBasics missingSlots={view.missingSlots} />
      ) : null}

      {currentOutfit ? (
        <OutfitCard
          outfit={currentOutfit}
          isPending={isPending}
          noMore={view.kind === "no_more"}
          onShowAnother={() => showAnother(currentOutfit.outfitId)}
        />
      ) : null}
    </div>
  );
}

function OutfitCard({
  outfit,
  isPending,
  noMore,
  onShowAnother,
}: {
  outfit: ServedOutfit;
  isPending: boolean;
  noMore: boolean;
  onShowAnother: () => void;
}) {
  const canShowAnother = outfit.hasMore && !noMore;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-5 dark:border-white/15">
      <p className="text-sm text-black/70 dark:text-white/70">{outfit.explanation}</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {outfit.items.map((item) => (
          <Link
            key={item.wardrobeItemId}
            href={`/wardrobe/${item.wardrobeItemId}`}
            className="flex flex-col overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.name}
              className="aspect-square w-full bg-black/5 object-cover dark:bg-white/10"
            />
            <div className="flex flex-col gap-0.5 p-2">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                {CATEGORY_LABELS[item.slot]}
                {item.color ? ` · ${item.color}` : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onShowAnother}
          disabled={!canShowAnother || isPending}
          className="rounded-full border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
        >
          {isPending ? "Loading…" : "Show another"}
        </button>
        {noMore || !outfit.hasMore ? (
          <span className="text-xs text-black/50 dark:text-white/50">
            No more options for this request.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function NeedsBasics({
  missingSlots,
  message,
}: {
  missingSlots: Category[] | null;
  message?: string;
}) {
  const text =
    message ??
    (missingSlots && missingSlots.length > 0
      ? `Add at least one item in: ${missingSlots
          .map((s) => CATEGORY_LABELS[s])
          .join(", ")} before generating an outfit.`
      : "Add the basics before generating an outfit.");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-black/15 p-6 text-sm dark:border-white/20">
      <p className="text-black/70 dark:text-white/70">{text}</p>
      <div>
        <Link
          href="/ingest/new"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Add items
        </Link>
      </div>
    </div>
  );
}
