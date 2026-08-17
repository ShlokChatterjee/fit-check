import Link from "next/link";

import { CategoryFilter } from "@/components/wardrobe/CategoryFilter";
import { WardrobeItemCard } from "@/components/wardrobe/WardrobeItemCard";
import { requireUser } from "@/lib/auth/guards";
import { listWardrobe } from "@/lib/wardrobe/service";
import { isCategory } from "@/lib/wardrobe/types";

export default async function WardrobePage({ searchParams }: PageProps<"/wardrobe">) {
  const userId = await requireUser();
  const params = await searchParams;
  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const active = isCategory(categoryParam) ? categoryParam : undefined;

  const items = await listWardrobe(userId, active ? { category: active } : {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your wardrobe</h1>
        <div className="flex gap-2">
          <Link
            href="/ingest/new"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Add from photo
          </Link>
          <Link
            href="/wardrobe/new"
            className="rounded-full border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Add manually
          </Link>
        </div>
      </div>

      <CategoryFilter active={active} />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
          {active
            ? "No items in this category yet."
            : "Your wardrobe is empty. Add your first item to get started."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <WardrobeItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
