import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { createItemFromForm } from "@/lib/wardrobe/actions";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/wardrobe/labels";

export default async function NewWardrobeItemPage() {
  await requireUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link href="/wardrobe" className="text-sm text-black/60 hover:underline dark:text-white/60">
          ← Back to wardrobe
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add an item</h1>
      </div>

      <form action={createItemFromForm} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="name">
          <input id="name" name="name" required maxLength={120} className={inputClass} />
        </Field>

        <Field label="Category" htmlFor="category">
          <select id="category" name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a category
            </option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Image URL" htmlFor="imageUrl">
          <input id="imageUrl" name="imageUrl" type="url" required className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Color" htmlFor="color">
            <input id="color" name="color" className={inputClass} />
          </Field>
          <Field label="Pattern" htmlFor="pattern">
            <input id="pattern" name="pattern" className={inputClass} />
          </Field>
        </div>

        <Field label="Material" htmlFor="material">
          <input id="material" name="material" className={inputClass} />
        </Field>

        <Field label="Descriptors" htmlFor="descriptors" hint="Comma-separated, e.g. cotton, slim, casual">
          <input id="descriptors" name="descriptors" className={inputClass} />
        </Field>

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Save item
          </button>
          <Link
            href="/wardrobe"
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-black/50 dark:text-white/50">{hint}</span> : null}
    </label>
  );
}
