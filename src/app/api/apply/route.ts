import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";
import {
  isWithinApplyWindow,
  canApplyMore,
} from "@/lib/apply/scheduler";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all approved applications
    const applications = await prisma.application.findMany({
      where: { status: "approved" },
      include: {
        vacancy: true,
        user: {
          include: { profile: true, platformAccounts: true },
        },
        searchProfile: true,
      },
    });

    if (applications.length === 0) {
      return NextResponse.json({
        applied: 0,
        failed: 0,
        newQuestions: 0,
        message: "No approved applications in queue",
      });
    }

    let applied = 0;
    let failed = 0;
    let skippedWindow = 0;
    let skippedLimit = 0;
    let newQuestions = 0;

    for (const app of applications) {
      try {
        const sp = app.searchProfile;

        // Check apply hours window
        if (
          !isWithinApplyWindow(
            sp.applyHoursStart,
            sp.applyHoursEnd,
            sp.applyTimezone
          )
        ) {
          skippedWindow++;
          continue;
        }

        // Check daily apply limit
        const hasCapacity = await canApplyMore(
          app.userId,
          sp.id,
          sp.maxDailyApplies
        );
        if (!hasCapacity) {
          skippedLimit++;
          continue;
        }

        // TODO: Implement Playwright-based auto-apply per platform
        // For now, mark as "pending_manual" — manual apply required
        // Future: check platform account, open browser, fill form, handle Q&A

        await prisma.application.update({
          where: { id: app.id },
          data: {
            status: "pending_manual",
            applyLog: `Queued for manual apply at ${new Date().toISOString()}. Auto-apply not yet implemented for ${app.vacancy.platform}.`,
          },
        });

        applied++;
      } catch (err) {
        console.error(
          `[apply] Failed application ${app.id}:`,
          err instanceof Error ? err.message : err
        );

        await prisma.application.update({
          where: { id: app.id },
          data: {
            status: "failed",
            applyLog: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        });

        failed++;
      }
    }

    // Count unanswered Q&A questions
    const pendingQuestions = await prisma.qaPair.count({
      where: { answer: null },
    });
    newQuestions = pendingQuestions;

    const summary = [
      `<b>JobFinder Apply</b>`,
      `Processed: ${applied + failed}`,
      `Queued for manual: ${applied}`,
      failed > 0 ? `Failed: ${failed}` : null,
      skippedWindow > 0 ? `Skipped (outside hours): ${skippedWindow}` : null,
      skippedLimit > 0 ? `Skipped (daily limit): ${skippedLimit}` : null,
      newQuestions > 0 ? `Pending Q&A: ${newQuestions}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramNotification(summary);

    // Create in-app notifications per user
    if (applied > 0) {
      const userIds = [
        ...new Set(applications.map((app) => app.userId)),
      ];
      for (const userId of userIds) {
        await createNotification(
          userId,
          "new_vacancies",
          `Applied to ${applied} jobs`,
          `${applied} applications processed, ${failed} failed`,
          "/applications"
        );
      }
    }

    // Notify about pending Q&A
    if (newQuestions > 0) {
      const userIds = [
        ...new Set(applications.map((app) => app.userId)),
      ];
      for (const userId of userIds) {
        await createNotification(
          userId,
          "qa_pending",
          `${newQuestions} Q&A questions pending`,
          "Answer pending questions to improve auto-apply accuracy",
          "/qa"
        );
      }
    }

    return NextResponse.json({
      applied,
      failed,
      skippedWindow,
      skippedLimit,
      newQuestions,
    });
  } catch (error) {
    console.error("[apply] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
