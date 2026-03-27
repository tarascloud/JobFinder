import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";
import {
  isWithinApplyWindow,
  canApplyMore,
} from "@/lib/apply/scheduler";
import { executeApplyForUser } from "@/actions/apply-executor";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(auth) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

interface ApplyAttemptResult {
  applicationId: number;
  vacancyTitle: string;
  company: string;
  success: boolean;
  error?: string;
  screenshotPath?: string;
  newQuestions?: string[];
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all approved applications with search profile for scheduling checks
    const applications = await prisma.application.findMany({
      where: { status: "approved" },
      include: {
        vacancy: { select: { title: true, company: true, platform: true } },
        searchProfile: {
          select: {
            id: true,
            applyHoursStart: true,
            applyHoursEnd: true,
            applyTimezone: true,
            maxDailyApplies: true,
          },
        },
      },
    });

    if (applications.length === 0) {
      return NextResponse.json({
        applied: 0,
        failed: 0,
        skippedWindow: 0,
        skippedLimit: 0,
        newQuestions: 0,
        results: [],
        message: "No approved applications in queue",
      });
    }

    let applied = 0;
    let failed = 0;
    let skippedWindow = 0;
    let skippedLimit = 0;
    let skippedRateLimit = 0;
    let newQuestions = 0;
    const results: ApplyAttemptResult[] = [];

    // Pre-load user application limits
    const userIds = [...new Set(applications.map((a) => a.userId))];
    const usersWithLimits = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, applicationLimit: true },
    });
    const userLimitMap = new Map(
      usersWithLimits.map((u) => [u.id, u.applicationLimit])
    );

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];

      try {
        const sp = app.searchProfile;

        // Check user-level application rate limit (last 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const userDailyCount = await prisma.application.count({
          where: {
            userId: app.userId,
            status: "applied",
            appliedAt: { gte: twentyFourHoursAgo },
          },
        });
        const userLimit = userLimitMap.get(app.userId) ?? 10;
        if (userDailyCount >= userLimit) {
          skippedRateLimit++;
          continue;
        }

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

        // Check daily apply limit (per search profile)
        const hasCapacity = await canApplyMore(
          app.userId,
          sp.id,
          sp.maxDailyApplies,
          sp.applyTimezone
        );
        if (!hasCapacity) {
          skippedLimit++;
          continue;
        }

        // Execute apply via the shared executor
        console.log(
          `[apply] Executing auto-apply #${app.id}: ${app.vacancy.title} at ${app.vacancy.company ?? "Unknown"} (${app.vacancy.platform})...`
        );

        const result = await executeApplyForUser(app.id, app.userId);

        const attemptResult: ApplyAttemptResult = {
          applicationId: app.id,
          vacancyTitle: app.vacancy.title,
          company: app.vacancy.company ?? "Unknown",
          success: result.success,
          error: result.error,
          screenshotPath: result.screenshotPath,
          newQuestions: result.newQuestions,
        };
        results.push(attemptResult);

        if (result.success) {
          applied++;
        } else {
          failed++;
        }

        if (result.newQuestions) {
          newQuestions += result.newQuestions.length;
        }

        // Delay between applications (5-10s) to avoid rate limiting
        if (i < applications.length - 1) {
          const delay = Math.floor(Math.random() * 5000) + 5000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (err) {
        // This catch handles unexpected errors not caught by executeApplyForUser
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[apply] Unexpected error for application ${app.id}:`, errorMsg);

        // executeApplyForUser already updates status on error, but if it threw
        // before reaching that point, update here as a safety net
        try {
          await prisma.application.update({
            where: { id: app.id },
            data: {
              status: "failed",
              failedAt: new Date(),
              errorMessage: errorMsg,
              applyLog: `Unexpected error: ${errorMsg}`,
            },
          });
        } catch {
          // Ignore update errors
        }

        results.push({
          applicationId: app.id,
          vacancyTitle: app.vacancy.title,
          company: app.vacancy.company ?? "Unknown",
          success: false,
          error: errorMsg,
        });

        failed++;
      }
    }

    // Count total unanswered Q&A questions for users in this batch
    const batchUserIds = [...new Set(applications.map((app) => app.userId))];
    const totalPendingQA = await prisma.qaPair.count({
      where: { answer: null, userId: { in: batchUserIds } },
    });

    // Send Telegram summary
    const summary = [
      `<b>JobFinder Apply</b>`,
      `Processed: ${applied + failed}`,
      `Applied: ${applied}`,
      failed > 0 ? `Failed: ${failed}` : null,
      skippedWindow > 0 ? `Skipped (outside hours): ${skippedWindow}` : null,
      skippedLimit > 0 ? `Skipped (daily limit): ${skippedLimit}` : null,
      skippedRateLimit > 0 ? `Skipped (rate limit): ${skippedRateLimit}` : null,
      newQuestions > 0 ? `New Q&A: ${newQuestions}` : null,
      totalPendingQA > 0 ? `Total pending Q&A: ${totalPendingQA}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramNotification(summary);

    // Create in-app notifications per user
    if (applied > 0) {
      for (const userId of batchUserIds) {
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
    if (totalPendingQA > 0) {
      for (const userId of batchUserIds) {
        await createNotification(
          userId,
          "qa_pending",
          `${totalPendingQA} Q&A questions pending`,
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
      skippedRateLimit,
      newQuestions,
      results,
    });
  } catch (error) {
    console.error("[apply] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
