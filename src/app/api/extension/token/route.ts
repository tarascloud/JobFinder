import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

/**
 * GET /api/extension/token — get current extension token for the authenticated user
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { extensionToken: true },
  });

  return NextResponse.json({ token: user?.extensionToken ?? null });
}

/**
 * POST /api/extension/token — generate or regenerate a per-user extension token
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const token = `jf_ext_${randomBytes(32).toString("hex")}`;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { extensionToken: token },
  });

  return NextResponse.json({ token });
}

/**
 * DELETE /api/extension/token — revoke the extension token
 */
export async function DELETE() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { extensionToken: null },
  });

  return NextResponse.json({ ok: true });
}
