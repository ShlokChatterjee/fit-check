import Link from "next/link";

import type { Category } from "@/app/generated/prisma/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/wardrobe/labels";

export function CategoryFilter({ active }: { active?: Category }) {
  return (
    <nav className="flex flex-wrap gap-2">
      <FilterChip href="/wardrobe" label="All" isActive={!active} />
      {CATEGORIES.map((category) => (
        <FilterChip
          key={category}
          href={`/wardrobe?category=${category}`}
          label={CATEGORY_LABELS[category]}
          isActive={active === category}
        />
      ))}
    </nav>
  );
}

function FilterChip({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? "rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
          : "rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      }
    >
      {label}
    </Link>
  );
}
