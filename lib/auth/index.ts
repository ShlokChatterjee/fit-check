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
      // Request the restricted Photos Picker scope so users can add clothing
      // from Google Photos (Feature 3, Method B). This grants access ONLY to
      // items the user explicitly picks — never their full library. offline
      // access + consent prompt ensure a refresh token is stored so the app can
      // call the Picker API on the user's behalf after the first hour.
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
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
