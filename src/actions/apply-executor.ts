"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { applyToVacancy, type ApplyResult, type ApplyContext } from "@/lib/apply";

export async function executeApply(applicationId: number): Promise<ApplyResult> {
  const log: string[] = [];

  try {
    const user = await requireUser();

    // 1. Load application with vacancy and user profile
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
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

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { success: false, log: ["User profile not found"], error: "User profile not found" };
    }

    // 2. Load platform credentials
    const platformAccount = await prisma.platformAccount.findFirst({
      where: {
        userId: user.id,
        platform: application.vacancy.platform,
        status: "active",
      },
    });

    if (!platformAccount?.email || !platformAccount.passwordEncrypted) {
      return {
        success: false,
        log: [`No active ${application.vacancy.platform} credentials found`],
        error: `No credentials for ${application.vacancy.platform}`,
      };
    }

    // 3. Load Q&A answers for this user
    const qaPairs = await prisma.qaPair.findMany({
      where: {
        userId: user.id,
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
      vacancy: {
        url: application.vacancy.url,
        title: application.vacancy.title,
        company: application.vacancy.company ?? "Unknown",
        platform: application.vacancy.platform,
      },
      profile: {
        name: user.name ?? "Unknown",
        email: user.email,
        phone: undefined, // phone not in User model; could extend later
        resumeUrl: profile.resumeUrl ?? "",
        portfolioUrls: profile.portfolioUrls,
      },
      coverLetter: application.coverLetter ?? "",
      qaAnswers,
    };

    // 5. Execute apply
    log.push(`Applying to ${ctx.vacancy.title} at ${ctx.vacancy.company} via ${ctx.vacancy.platform}...`);

    // Note: passwordEncrypted should be decrypted before use in production.
    // For now we pass it as-is — a proper decryption layer should be added.
    const credentials = {
      email: platformAccount.email,
      password: platformAccount.passwordEncrypted,
    };

    const result = await applyToVacancy(ctx, credentials);

    // 6. Update application status
    const newStatus = result.success ? "applied" : "failed";
    const allLogs = [...log, ...result.log];

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        appliedAt: result.success ? new Date() : undefined,
        screenshotPath: result.screenshotPath ?? undefined,
        applyLog: allLogs.join("\n"),
      },
    });

    log.push(`Application status updated to "${newStatus}"`);

    // 7. If new questions found, create QaPair entries
    if (result.newQuestions && result.newQuestions.length > 0) {
      log.push(`Found ${result.newQuestions.length} new screening question(s)`);

      for (const question of result.newQuestions) {
        // Check if this question already exists for this user
        const existing = await prisma.qaPair.findFirst({
          where: {
            userId: user.id,
            question: { equals: question, mode: "insensitive" },
          },
        });

        if (!existing) {
          await prisma.qaPair.create({
            data: {
              userId: user.id,
              question,
              sourceVacancyId: application.vacancyId,
              category: "screening",
            },
          });
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
    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}

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
