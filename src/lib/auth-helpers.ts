import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "./current-user";

/**
 * Require authenticated user for API routes.
 * Returns the user or a 401 NextResponse.
 *
 * Thin wrapper over `requireUser()` from current-user.ts — single source of
 * session→user resolution. Converts the thrown "Unauthorized" into the
 * NextResponse shape API routes expect.
 */
export async function requireAuth() {
  try {
    const user = await requireUser();
    return { error: null, user };
  } catch {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }
}

/**
 * Require authenticated non-demo user (id !== 0).
 * Returns the user or a 401 NextResponse.
 *
 * Thin wrapper over `requireUser()` from current-user.ts with extra check
 * to exclude the demo user (id === 0).
 */
export async function requireRealUser() {
  try {
    const user = await requireUser();
    if (user.id === 0) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        user: null,
      };
    }
    return { error: null, user };
  } catch {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }
}

/**
 * Require owner role for API routes.
 * Returns the user or a 403 NextResponse.
 *
 * Uses `getCurrentUser()` directly (not requireUser) because we need to
 * differentiate "no user → 403 Forbidden" wording from a role check failure.
 * Both unauthenticated and non-owner return 403 to avoid leaking which
 * endpoints require owner role.
 */
export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}
