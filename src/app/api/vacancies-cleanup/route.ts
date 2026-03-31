import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.JOBFINDER_CRON_SECRET;
  if (!secret || !auth || !timingSafeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Archive vacancies older than 30 days that haven't been applied to
  const result = await prisma.vacancy.updateMany({
    where: {
      isArchived: false,
      scrapedAt: { lt: thirtyDaysAgo },
      applications: { none: {} },
    },
    data: {
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  return NextResponse.json({
    archived: result.count,
    cutoffDate: thirtyDaysAgo.toISOString(),
  });
}
