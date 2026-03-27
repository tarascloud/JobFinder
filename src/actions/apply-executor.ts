"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { applyToVacancy, type ApplyResult, type ApplyContext } from "@/lib/apply";
import { getApplyEmail } from "@/lib/apply-email";
import { decryptGraceful } from "@/lib/encryption";
import { createNotification } from "@/actions/notifications";
import { sendTelegramNotification } from "@/lib/telegram";

/**
 * Core apply execution — works without session auth.
 * Called by the cron API route and by the session-based executeApply().
 */
export async function executeApplyForUser(applicationId: number, userId: number): Promise<ApplyResult> {
  const log: string[] = [];

  try {
    // 1. Load application with vacancy and user profile
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: {
        vacancy: true,
        searchProfile: true,
      },
    });

    if (!application) {
      return { success: false, log: ["Application not found"], error: "Application not found" };
    }

    if (application.status !== "approved") {
      return {
        success: false,
        log: [`Application status is "${application.status}" — only "approved" can be executed`],
        error: `Cannot apply: status is "${application.status}"`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, log: ["User not found"], error: "User not found" };
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { success: false, log: ["User profile not found"], error: "User profile not found" };
    }

    // 2. Load platform credentials
    const platformAccount = await prisma.platformAccount.findFirst({
      where: {
        userId,
        platform: application.vacancy.platform,
        status: "active",
      },
    });

    if (!platformAccount?.email || !platformAccount.passwordEncrypted) {
      // Mark as pending_manual when no credentials available
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "pending_manual",
          applyLog: `No ${application.vacancy.platform} credentials found. Manual apply required.`,
        },
      });
      return {
        success: false,
        log: [`No active ${application.vacancy.platform} credentials found — marked as pending_manual`],
        error: `No credentials for ${application.vacancy.platform}`,
      };
    }

    // 3. Load Q&A answers for this user
    const qaPairs = await prisma.qaPair.findMany({
      where: {
        userId,
        answer: { not: null },
      },
    });

    const qaAnswers = new Map<string, string>();
    for (const qa of qaPairs) {
      if (qa.answer) {
        qaAnswers.set(qa.question, qa.answer);
      }
    }

    log.push(`Loaded ${qaAnswers.size} Q&A answers`);

    // 4. Build apply context
    const ctx: ApplyContext = {
      userId,
      platformAccountId: platformAccount.id,
      vacancy: {
        url: application.vacancy.url,
        title: application.vacancy.title,
        company: application.vacancy.company ?? "Unknown",
        platform: application.vacancy.platform,
      },
      profile: {
        name: user.name ?? "Unknown",
        email: user.email,
        applyEmail: getApplyEmail(user.email),
        phone: undefined,
        resumeUrl: profile.resumeUrl ?? "",
        portfolioUrls: profile.portfolioUrls,
      },
      coverLetter: application.coverLetter ?? "",
      qaAnswers,
    };

    // 5. Execute apply
    log.push(`Applying to ${ctx.vacancy.title} at ${ctx.vacancy.company} via ${ctx.vacancy.platform}...`);

    const credentials = {
      email: platformAccount.email,
      password: platformAccount.passwordEncrypted
        ? decryptGraceful(platformAccount.passwordEncrypted)
        : "",
    };

    const result = await applyToVacancy(ctx, credentials);

    // 6. Detect if applied with personal account (not @jf.taras.cloud service email)
    const isPersonalAccount = !!(
      platformAccount.email &&
      !platformAccount.email.endsWith("@jf.taras.cloud") &&
      platformAccount.email !== "jf@taras.cloud"
    );

    const allLogs = [...log, ...result.log];

    // 6a. Handle paused result — application waiting for Q&A answers
    if (result.paused) {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "pending_qa",
          screenshotPath: result.screenshotPath ?? undefined,
          applyLog: allLogs.join("\n"),
        },
      });

      log.push('Application status updated to "pending_qa"');

      // Save new questions to Q&A base
      let newQuestionsCount = 0;
      if (result.newQuestions && result.newQuestions.length > 0) {
        for (const question of result.newQuestions) {
          const existing = await prisma.qaPair.findFirst({
            where: {
              userId,
              question: { equals: question, mode: "insensitive" },
            },
          });

          if (!existing) {
            // Check if AI provided a suggested answer for this question
            const suggested = result.suggestedAnswers?.find(
              (s) => s.question === question
            );
            await prisma.qaPair.create({
              data: {
                userId,
                question,
                answer: suggested?.answer ?? null,
                sourceVacancyId: application.vacancyId,
                category: "screening",
                source: suggested ? "ai" : "manual",
              },
            });
            newQuestionsCount++;
          }
        }
      }

      // Create in-app notification
      const questionsLabel = newQuestionsCount === 1 ? "question" : "questions";
      await createNotification(
        userId,
        "apply_paused",
        `Application paused — answer ${newQuestionsCount} new ${questionsLabel}`,
        `"${application.vacancy.title}" at ${application.vacancy.company ?? "Unknown"} requires answers to screening questions before submission.`,
        "/qa"
      );

      // Send Telegram notification
      await sendTelegramNotification(
        `⏸ <b>Application paused</b>\n` +
        `${application.vacancy.title} at ${application.vacancy.company ?? "Unknown"}\n` +
        `${newQuestionsCount} new screening ${questionsLabel} need answers.\n` +
        `Answer them in Q&A, then retry.`
      );

      return {
        success: false,
        paused: true,
        screenshotPath: result.screenshotPath,
        newQuestions: result.newQuestions,
        log: allLogs,
      };
    }

    // 7. Update application status with tracking fields
    const now = new Date();
    const isSuccess = result.success;

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: isSuccess ? "applied" : "failed",
        appliedAt: isSuccess ? now : undefined,
        failedAt: isSuccess ? undefined : now,
        errorMessage: isSuccess ? null : (result.error ?? "Unknown error"),
        screenshotPath: result.screenshotPath ?? undefined,
        applyLog: allLogs.join("\n"),
        ...(isSuccess && isPersonalAccount && { appliedWithPersonalAccount: true }),
      },
    });

    log.push(`Application status updated to "${isSuccess ? "applied" : "failed"}"`);

    // 8. If new questions found, create QaPair entries
    let newQuestionsCount = 0;
    if (result.newQuestions && result.newQuestions.length > 0) {
      log.push(`Found ${result.newQuestions.length} new screening question(s)`);

      for (const question of result.newQuestions) {
        const existing = await prisma.qaPair.findFirst({
          where: {
            userId,
            question: { equals: question, mode: "insensitive" },
          },
        });

        if (!existing) {
          // Check if AI provided a suggested answer for this question
          const suggested = result.suggestedAnswers?.find(
            (s) => s.question === question
          );
          await prisma.qaPair.create({
            data: {
              userId,
              question,
              answer: suggested?.answer ?? null,
              sourceVacancyId: application.vacancyId,
              category: "screening",
              source: suggested ? "ai" : "manual",
            },
          });
          newQuestionsCount++;
        }
      }

      log.push("New questions saved to Q&A base for review");
    }

    return {
      success: result.success,
      screenshotPath: result.screenshotPath,
      newQuestions: result.newQuestions,
      log: allLogs,
      error: result.error,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    log.push(`Fatal error: ${errorMsg}`);

    // Try to update application status on fatal error
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorMessage: errorMsg,
          applyLog: log.join("\n"),
        },
      });
    } catch {
      // If we can't update the application, just log and move on
      log.push("Could not update application status after fatal error");
    }

    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}

/**
 * Session-based wrapper — called from UI (server actions).
 * Requires an authenticated user session.
 */
export async function executeApply(applicationId: number): Promise<ApplyResult> {
  const user = await requireUser();
  return executeApplyForUser(applicationId, user.id);
}

/**
 * Batch apply — executes multiple applications sequentially with delay.
 */
export async function executeBatchApply(
  applicationIds: number[]
): Promise<{ succeeded: number; failed: number; newQuestions: number }> {
  let succeeded = 0;
  let failed = 0;
  let newQuestions = 0;

  for (const id of applicationIds) {
    const result = await executeApply(id);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    if (result.newQuestions) {
      newQuestions += result.newQuestions.length;
    }

    // Delay between applications to avoid rate limiting (5-10 seconds)
    if (applicationIds.indexOf(id) < applicationIds.length - 1) {
      const delay = Math.floor(Math.random() * 5000) + 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { succeeded, failed, newQuestions };
}
