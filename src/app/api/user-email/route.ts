import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

function verifyApiToken(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_EMAIL_API_TOKEN;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(auth) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

/**
 * GET /api/user-email?username=tpedchenko
 * Looks up user by email local part (tpedchenko → tpedchenko@*).
 * Returns personal email for forwarding recruiter replies.
 * Protected by Bearer token (used by CF Email Worker).
 */
export async function GET(request: NextRequest) {
  if (!verifyApiToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "Missing username parameter" },
      { status: 400 }
    );
  }

  try {
    // Find user whose email starts with username@
    const user = await prisma.user.findFirst({
      where: { email: { startsWith: `${username}@` } },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ email: user.email, userId: user.id });
  } catch (error) {
    console.error("[user-email] Error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
