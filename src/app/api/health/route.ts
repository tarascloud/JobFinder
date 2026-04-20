import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: "error", db: "fail", error: String(err) }, { status: 503 });
  }
}
