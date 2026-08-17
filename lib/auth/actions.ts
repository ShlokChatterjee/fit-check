"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/wardrobe" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
