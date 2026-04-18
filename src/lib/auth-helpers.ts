import { NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";

/**
 * Require authenticated user for API routes.
 * Returns the user or a 401 NextResponse.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * Require authenticated non-demo user (id !== 0).
 * Returns the user or a 401 NextResponse.
 */
export async function requireRealUser() {
  const user = await getCurrentUser();
  if (!user || user.id === 0) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * Require owner role for API routes.
 * Returns the user or a 403 NextResponse.
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
