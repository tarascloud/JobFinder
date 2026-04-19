import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPlatformRegistrationStatus } from "@/actions/auto-register";

/**
 * GET /api/platforms/accounts
 *
 * Returns auto-registration status for all registerable platforms.
 * Includes account details if user has already registered on a platform.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;
  if (authResult.user.id === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platforms = await getPlatformRegistrationStatus();
  return NextResponse.json({ platforms });
}
