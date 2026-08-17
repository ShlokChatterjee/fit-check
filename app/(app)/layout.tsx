import Link from "next/link";

import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protect every route in this group. Redirects to the landing page when
  // unauthenticated (application-enforced, not middleware/edge).
  await requireUser();
  const session = await auth();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/wardrobe" className="text-lg font-semibold tracking-tight">
            Wardrobe Agent
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-black/60 sm:inline dark:text-white/60">
              {session?.user?.name ?? session?.user?.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
