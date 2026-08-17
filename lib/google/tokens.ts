import { prisma } from "@/lib/db/prisma";

// Google OAuth token access for server-side API calls (Feature 3, Method B).
// Auth.js (database sessions) stores the user's Google tokens on the Account
// row via the Prisma adapter. It does not auto-refresh them, so this module
// reads the stored access token and refreshes it when expired. Provider-specific
// code stays isolated here.

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 60_000; // refresh a minute early to avoid edge failures

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Return a valid Google access token for the user, refreshing it if it has
 * expired. Throws GoogleAuthError when no Google account is linked.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) {
    throw new GoogleAuthError("Google account is not connected");
  }

  const expiresAtMs = (account.expires_at ?? 0) * 1000;
  const stillValid = account.expires_at !== null && Date.now() < expiresAtMs - EXPIRY_SKEW_MS;
  if (stillValid) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    // No refresh token (older consent): hand back what we have and let the
    // caller surface a re-connect prompt if the API rejects it.
    return account.access_token;
  }

  const refreshed = await refreshAccessToken(account.refresh_token);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
    },
  });
  return refreshed.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new GoogleAuthError(`Google token refresh failed (${res.status})`);
  }
  return (await res.json()) as RefreshResponse;
}
