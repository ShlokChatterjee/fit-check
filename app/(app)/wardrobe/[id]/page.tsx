import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireUser, requireUserId } from "@/lib/auth/guards";
import { toggleFavoriteAction, setActiveAction } from "@/lib/wardrobe/actions";
import * as service from "@/lib/wardrobe/service";
import { isCategory } from "@/lib/wardrobe/types";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/wardrobe/labels";

export default async function WardrobeItemPage({ params }: PageProps<"/wardrobe/[id]">) {
  const userId = await requireUser();
  const { id } = await params;
  const item = await service.getItem(userId, id);
  if (!item) notFound();

  async function updateAction(formData: FormData) {
    "use server";
    const uid = await requireUserId();
    const category = String(formData.get("category") ?? "");
    const descriptorsRaw = String(formData.get("descriptors") ?? "").trim();
    await service.updateItem(uid, id, {
      ...(isCategory(category) ? { category } : {}),
      name: String(formData.get("name") ?? ""),
      color: emptyToNull(formData.get("color")),
      pattern: emptyToNull(formData.get("pattern")),
      material: emptyToNull(formData.get("material")),
      descriptors: descriptorsRaw
        ? descriptorsRaw.split(",").map((d) => d.trim()).filter(Boolean)
        : [],
    });
    revalidatePath(`/wardrobe/${id}`);
    revalidatePath("/wardrobe");
    redirect(`/wardrobe/${id}`);
  }

  async function deleteAction() {
    "use server";
    const uid = await requireUserId();
    await service.deleteItem(uid, id);
    revalidatePath("/wardrobe");
    redirect("/wardrobe");
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/wardrobe" className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← Back to wardrobe
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.name}
            className="aspect-square w-full rounded-xl bg-black/5 object-cover dark:bg-white/10"
          />
          <div className="mt-3 flex items-center gap-3">
            <form action={toggleFavoriteAction.bind(null, item.id)}>
              <button type="submit" className={secondaryButton}>
                {item.isFavorite ? "★ Favorited" : "☆ Favorite"}
              </button>
            </form>
            <form action={setActiveAction.bind(null, item.id, !item.isActive)}>
              <button type="submit" className={secondaryButton}>
                {item.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          </div>
          {!item.isActive ? (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              Deactivated items are kept but excluded from outfit generation.
            </p>
          ) : null}
        </div>

        <form action={updateAction} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name">
            <input id="name" name="name" required defaultValue={item.name} className={inputClass} />
          </Field>
          <Field label="Category" htmlFor="category">
            <select id="category" name="category" defaultValue={item.category} className={inputClass}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Color" htmlFor="color">
              <input id="color" name="color" defaultValue={item.color ?? ""} className={inputClass} />
            </Field>
            <Field label="Pattern" htmlFor="pattern">
              <input id="pattern" name="pattern" defaultValue={item.pattern ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Material" htmlFor="material">
            <input id="material" name="material" defaultValue={item.material ?? ""} className={inputClass} />
          </Field>
          <Field label="Descriptors" htmlFor="descriptors" hint="Comma-separated">
            <input
              id="descriptors"
              name="descriptors"
              defaultValue={item.descriptors.join(", ")}
              className={inputClass}
            />
          </Field>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="submit"
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>

      <form action={deleteAction} className="border-t border-black/10 pt-6 dark:border-white/15">
        <button type="submit" className="text-sm text-red-600 hover:underline dark:text-red-400">
          Delete this item
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20";

const secondaryButton =
  "rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : null;
}

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
