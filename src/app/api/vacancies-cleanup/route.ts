import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronSecret } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
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
