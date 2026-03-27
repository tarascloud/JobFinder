"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import type { AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair } from "@/actions/profile";

/**
 * Skip onboarding entirely — create an empty profile and redirect to /profile.
 */
export async function skipOnboarding() {
  try {
    const user = await requireUser();
    console.log("[skipOnboarding] Skipping onboarding for user:", user.id);

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        skills: [],
        languages: [],
        portfolioUrls: [],
        preferredLocations: [],
        employmentTypes: [],
      },
      update: {},
    });

    return { ok: true };
  } catch (e) {
    console.error("[skipOnboarding] Error:", e);
    return { error: e instanceof Error ? e.message : "Failed to skip onboarding" };
  }
}

/**
 * Reset onboarding — delete the user profile so OnboardingGate redirects to /onboarding.
 */
export async function resetOnboarding() {
  try {
    const user = await requireUser();
    console.log("[resetOnboarding] Resetting onboarding for user:", user.id);

    // Delete profile if exists (deleteMany doesn't throw if not found)
    await prisma.userProfile.deleteMany({
      where: { userId: user.id },
    });

    return { ok: true };
  } catch (e) {
    console.error("[resetOnboarding] Error:", e);
    return { error: e instanceof Error ? e.message : "Failed to reset onboarding" };
  }
}

export async function completeOnboarding(
  profileData: AnalyzedProfile & { resumeUrl: string; resumeFilename?: string },
  searchProfiles: AnalyzedSearchProfile[],
  qaPairs: AnalyzedQaPair[]
) {
  try {
    const user = await requireUser();
    console.log("[completeOnboarding] Starting for user:", user.id, "headline:", profileData.headline);

    // Validate input data
    const profilePayload = {
      headline: profileData.headline || null,
      summary: profileData.summary || null,
      yearsExperience: typeof profileData.yearsExperience === "number" ? profileData.yearsExperience : null,
      skills: Array.isArray(profileData.skills) ? profileData.skills : [],
      languages: Array.isArray(profileData.languages) ? profileData.languages : [],
      portfolioUrls: Array.isArray(profileData.portfolioUrls) ? profileData.portfolioUrls : [],
      resumeUrl: profileData.resumeUrl || null,
      resumeFilename: profileData.resumeFilename || null,
      salaryMin: typeof profileData.salaryMin === "number" ? profileData.salaryMin : null,
      salaryCurrency: profileData.salaryCurrency || null,
      preferredLocations: Array.isArray(profileData.preferredLocations) ? profileData.preferredLocations : [],
      preferredRemoteType: profileData.preferredRemoteType || null,
      employmentTypes: Array.isArray(profileData.employmentTypes) ? profileData.employmentTypes : [],
      // Extended auto-apply fields from AI analysis
      firstName: profileData.firstName || null,
      lastName: profileData.lastName || null,
      phone: profileData.phone || null,
      location: profileData.location || null,
      currentTitle: profileData.currentTitle || null,
      currentCompany: profileData.currentCompany || null,
      linkedinUrl: profileData.linkedinUrl || null,
      githubUrl: profileData.githubUrl || null,
      portfolioUrl: profileData.portfolioUrl || null,
      certifications: Array.isArray(profileData.certifications) ? profileData.certifications.join(", ") : (profileData.certifications || null),
      experience: Array.isArray(profileData.experience) ? JSON.stringify(profileData.experience) : (profileData.experience || null),
      educationHistory: Array.isArray(profileData.educationHistory) ? JSON.stringify(profileData.educationHistory) : (profileData.educationHistory || null),
    };

    // Use a transaction to save everything atomically
    await prisma.$transaction(async (tx) => {
      // 1. Upsert user profile
      console.log("[completeOnboarding] Upserting profile with", profilePayload.skills.length, "skills,", profilePayload.languages.length, "languages");
      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...profilePayload,
        },
        update: profilePayload,
      });

      // 1b. Clear analysis status so profile page doesn't show stale reanalysis panel
      await tx.userProfile.update({
        where: { userId: user.id },
        data: { analysisStatus: "idle", analysisResult: null },
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
              category: p.category || "linkedin_apply",
              source: "manual",
            },
          });
        }
      }
    });

    console.log("[completeOnboarding] Success for user:", user.id);
    return { ok: true };
  } catch (e) {
    console.error("[completeOnboarding] Error:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to complete onboarding",
    };
  }
}
