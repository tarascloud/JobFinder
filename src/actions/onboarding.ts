"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import type { AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair } from "@/actions/profile";

export async function completeOnboarding(
  profileData: AnalyzedProfile & { resumeUrl: string },
  searchProfiles: AnalyzedSearchProfile[],
  qaPairs: AnalyzedQaPair[]
) {
  try {
    const user = await requireUser();

    // Use a transaction to save everything atomically
    await prisma.$transaction(async (tx) => {
      // 1. Upsert user profile
      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          headline: profileData.headline || null,
          summary: profileData.summary || null,
          yearsExperience: profileData.yearsExperience,
          skills: profileData.skills,
          languages: profileData.languages,
          portfolioUrls: profileData.portfolioUrls,
          resumeUrl: profileData.resumeUrl || null,
          salaryMin: profileData.salaryMin,
          salaryCurrency: profileData.salaryCurrency || null,
          preferredLocations: profileData.preferredLocations,
          preferredRemoteType: profileData.preferredRemoteType || null,
          employmentTypes: profileData.employmentTypes,
        },
        update: {
          headline: profileData.headline || null,
          summary: profileData.summary || null,
          yearsExperience: profileData.yearsExperience,
          skills: profileData.skills,
          languages: profileData.languages,
          portfolioUrls: profileData.portfolioUrls,
          resumeUrl: profileData.resumeUrl || null,
          salaryMin: profileData.salaryMin,
          salaryCurrency: profileData.salaryCurrency || null,
          preferredLocations: profileData.preferredLocations,
          preferredRemoteType: profileData.preferredRemoteType || null,
          employmentTypes: profileData.employmentTypes,
        },
      });

      // 2. Upsert search profiles (may already exist from auto-creation)
      // Delete AI-created ones that user removed during review
      const existingSearches = await tx.searchProfile.findMany({
        where: { userId: user.id, source: "ai" },
        select: { id: true, name: true },
      });
      const reviewedNames = new Set(searchProfiles.map((sp) => sp.name));
      const toDelete = existingSearches.filter((e) => !reviewedNames.has(e.name));
      if (toDelete.length > 0) {
        await tx.searchProfile.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        });
      }

      for (const sp of searchProfiles) {
        const existing = await tx.searchProfile.findFirst({
          where: { userId: user.id, name: sp.name },
        });
        if (existing) {
          await tx.searchProfile.update({
            where: { id: existing.id },
            data: {
              jobTitles: sp.jobTitles,
              minSalary: sp.minSalary,
              currency: sp.currency || "EUR",
              employmentTypes: sp.employmentTypes,
              remoteOnly: sp.remoteOnly,
              geographies: sp.geographies,
              source: existing.source === "ai" ? "ai_edited" : existing.source,
            },
          });
        } else {
          await tx.searchProfile.create({
            data: {
              userId: user.id,
              name: sp.name || "My Job Search",
              jobTitles: sp.jobTitles,
              minSalary: sp.minSalary,
              currency: sp.currency || "EUR",
              employmentTypes: sp.employmentTypes,
              remoteOnly: sp.remoteOnly,
              geographies: sp.geographies,
              source: "manual",
            },
          });
        }
      }

      // 3. Upsert Q&A pairs (may already exist from auto-creation)
      const existingQa = await tx.qaPair.findMany({
        where: { userId: user.id, source: "ai" },
        select: { id: true, question: true },
      });
      const reviewedQuestions = new Set(qaPairs.map((p) => p.question));
      const qaToDelete = existingQa.filter((e) => !reviewedQuestions.has(e.question));
      if (qaToDelete.length > 0) {
        await tx.qaPair.deleteMany({
          where: { id: { in: qaToDelete.map((d) => d.id) } },
        });
      }

      for (const p of qaPairs) {
        const existing = await tx.qaPair.findFirst({
          where: { userId: user.id, question: p.question },
        });
        if (existing) {
          await tx.qaPair.update({
            where: { id: existing.id },
            data: {
              answer: p.answer,
              answeredAt: new Date(),
              source: existing.source === "ai" ? "ai_edited" : existing.source,
            },
          });
        } else {
          await tx.qaPair.create({
            data: {
              userId: user.id,
              question: p.question,
              answer: p.answer,
              answeredAt: new Date(),
              category: "resume",
              source: "manual",
            },
          });
        }
      }
    });

    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to complete onboarding",
    };
  }
}
