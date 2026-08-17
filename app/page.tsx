import Link from "next/link";

import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/lib/auth/actions";

export default async function LandingPage() {
  const session = await auth();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Wardrobe Agent</h1>
        <p className="mt-4 text-base text-black/60 dark:text-white/60">
          Build outfits from the clothes you already own. Add your wardrobe, and
          let the app do the styling.
        </p>

        <div className="mt-10">
          {session?.user ? (
            <Link
              href="/wardrobe"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Go to your wardrobe
            </Link>
          ) : (
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 dark:border-white/20"
              >
                Continue with Google
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
