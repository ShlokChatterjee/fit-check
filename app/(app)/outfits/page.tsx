import { OutfitGenerator } from "@/components/outfits/OutfitGenerator";
import { requireUser } from "@/lib/auth/guards";
import { meetsBaseline } from "@/lib/outfits/constraints";
import { listWardrobe } from "@/lib/wardrobe/service";

export default async function OutfitsPage() {
  const userId = await requireUser();
  const active = await listWardrobe(userId, { activeOnly: true });
  const baselineOk = meetsBaseline(active);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outfit ideas</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Describe the occasion and we&apos;ll build a look from clothes you
          already own — one at a time.
        </p>
      </div>

      <OutfitGenerator baselineOk={baselineOk} />
    </div>
  );
}
