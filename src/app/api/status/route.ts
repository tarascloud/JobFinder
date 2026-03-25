import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeSearches,
      newVacancies24h,
      pendingQueue,
      appliedToday,
      pendingQuestions,
    ] = await Promise.all([
      prisma.searchProfile.count({ where: { isActive: true } }),
      prisma.vacancy.count({ where: { scrapedAt: { gte: twentyFourHoursAgo } } }),
      prisma.application.count({ where: { status: { in: ["queued", "approved"] } } }),
      prisma.application.count({
        where: {
          appliedAt: { gte: todayStart },
          status: { in: ["applied", "pending_manual"] },
        },
      }),
      prisma.qaPair.count({ where: { answer: null } }),
    ]);

    return NextResponse.json({
      activeSearches,
      newVacancies24h,
      pendingQueue,
      appliedToday,
      pendingQuestions,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
