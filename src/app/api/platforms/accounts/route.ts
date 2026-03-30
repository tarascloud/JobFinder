import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getPlatformRegistrationStatus } from "@/actions/auto-register";

/**
 * GET /api/platforms/accounts
 *
 * Returns auto-registration status for all registerable platforms.
 * Includes account details if user has already registered on a platform.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.id === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platforms = await getPlatformRegistrationStatus();
  return NextResponse.json({ platforms });
}
