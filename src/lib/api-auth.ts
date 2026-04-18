import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Verify a cron secret from the Authorization header (Bearer token).
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  return verifyApiToken(request, "JOBFINDER_CRON_SECRET");
}

/**
 * Verify an API token from the Authorization header (Bearer token).
 * Accepts one or more env var names — returns true if any matches.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyApiToken(
  request: NextRequest,
  ...envVars: string[]
): boolean {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);

  for (const envVar of envVars) {
    const secret = process.env[envVar];
    if (!secret) continue;
    try {
      if (timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
        return true;
      }
    } catch {
      // Buffer length mismatch — this secret doesn't match, try next
    }
  }

  return false;
}

/**
 * Require an authenticated user (session or demo mode).
 * Returns a discriminated union: check `authorized` before accessing `user`.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { authorized: true as const, user, response: undefined };
}
