import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Error thrown by server actions when there is no authenticated user.
 * Application logic — never the LLM — enforces authentication.
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

/**
 * For Server Components / pages: redirect to sign-in when unauthenticated,
 * otherwise return the authenticated user's id.
 */
export async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  return session.user.id;
}

/**
 * For Server Actions: throw when unauthenticated (do not redirect mid-mutation).
 * Returns the authenticated user's id for ownership scoping.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }
  return session.user.id;
}
