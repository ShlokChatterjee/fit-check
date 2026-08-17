import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/db/prisma";

// Google is the only authentication provider in V1 (see Claude/plan.md Feature 1).
// Users/accounts/sessions persist via the Prisma adapter (database sessions).
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Expose the authenticated user id so application code can scope every
    // read/write to the owner. The app — not the LLM — is the ownership source.
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
