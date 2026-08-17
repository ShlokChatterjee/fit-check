import { GapSuggestions } from "@/components/gaps/GapSuggestions";
import { requireUser } from "@/lib/auth/guards";

export default async function SuggestionsPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s missing</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          On request, we analyze your wardrobe and suggest the category of item
          that would unlock the most new outfits — grounded in what you already
          own, never specific products.
        </p>
      </div>

      <GapSuggestions />
    </div>
  );
}
