"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { Category } from "@/app/generated/prisma/client";
import { getGapSuggestionsAction } from "@/lib/gaps/actions";
import type { GapResult, GapSuggestion } from "@/lib/gaps/types";
import { CATEGORY_LABELS } from "@/lib/wardrobe/labels";

export function GapSuggestions() {
  const [result, setResult] = useState<GapResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function analyze() {
    startTransition(async () => {
      setResult(await getGapSuggestionsAction());
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={analyze}
          disabled={isPending}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Analyzing…" : "Suggest what's missing"}
        </button>
      </div>

      {result?.status === "needs_basics" ? (
        <NeedsBasics missingSlots={result.missingSlots} />
      ) : null}

      {result?.status === "ok" ? (
        result.suggestions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {result.suggestions.map((s) => (
              <SuggestionRow key={s.category} suggestion={s} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
            Your wardrobe looks well-rounded — no obvious gaps right now.
          </p>
        )
      ) : null}
    </div>
  );
}

function SuggestionRow({ suggestion }: { suggestion: GapSuggestion }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">Consider adding {suggestion.label}</span>
        <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
          {CATEGORY_LABELS[suggestion.category]}
        </span>
      </div>
      <p className="text-sm text-black/70 dark:text-white/70">{suggestion.reason}</p>
    </li>
  );
}

function NeedsBasics({ missingSlots }: { missingSlots: Category[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-black/15 p-6 text-sm dark:border-white/20">
      <p className="text-black/70 dark:text-white/70">
        Add at least one item in:{" "}
        {missingSlots.map((s) => CATEGORY_LABELS[s]).join(", ")} before we can
        analyze wardrobe gaps.
      </p>
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
