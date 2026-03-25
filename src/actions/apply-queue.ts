"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { generateCoverLetter as generateCoverLetterAI } from "@/lib/ai/cover-letter";

export async function queueVacancyForApply(
  vacancyId: number,
  searchProfileId: number
) {
  try {
    const user = await requireUser();

    // Verify search profile ownership
    const searchProfile = await prisma.searchProfile.findFirst({
      where: { id: searchProfileId, userId: user.id },
    });
    if (!searchProfile) return { error: "Search profile not found" };

    // Check if already queued/applied
    const existing = await prisma.application.findUnique({
      where: { userId_vacancyId: { userId: user.id, vacancyId } },
    });
    if (existing) {
      return { error: `Already ${existing.status} for this vacancy` };
    }

    // Get vacancy
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });
    if (!vacancy) return { error: "Vacancy not found" };

    // Get user profile for cover letter generation
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    // Generate cover letter
    const language = vacancy.language ?? undefined;
    let coverLetter: string | null = null;
    try {
      coverLetter = await generateCoverLetterAI(
        {
          title: vacancy.title,
          company: vacancy.company,
          description: vacancy.description,
        },
        {
          headline: userProfile.headline,
          summary: userProfile.summary,
          yearsExperience: userProfile.yearsExperience,
          skills: userProfile.skills,
        },
        language
      );
    } catch {
      // Cover letter generation failed, proceed without it
    }

    // Create application with queued status
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        vacancyId,
        searchProfileId,
        status: "queued",
        coverLetter,
      },
      include: {
        vacancy: {
          select: {
            id: true,
            title: true,
            company: true,
            platform: true,
            url: true,
            salaryText: true,
          },
        },
      },
    });

    return { application, coverLetter };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to queue vacancy" };
  }
}

export async function getApplyQueue() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["queued", "approved"] },
      },
      include: {
        vacancy: {
          select: {
            id: true,
            title: true,
            company: true,
            platform: true,
            url: true,
            location: true,
            remoteType: true,
            salaryText: true,
          },
        },
        searchProfile: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get match scores for these vacancies
    const vacancyIds = applications.map((a) => a.vacancyId);
    const scores = await prisma.vacancyScore.findMany({
      where: {
        userId: user.id,
        vacancyId: { in: vacancyIds },
      },
      orderBy: { matchScore: "desc" },
    });

    const scoreMap = new Map<number, number>();
    for (const s of scores) {
      if (!scoreMap.has(s.vacancyId)) {
        scoreMap.set(s.vacancyId, s.matchScore);
      }
    }

    return {
      applications: applications.map((a) => ({
        ...a,
        matchScore: scoreMap.get(a.vacancyId) ?? null,
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load apply queue" };
  }
}

export async function approveWithCoverLetter(
  applicationId: number,
  coverLetter: string
) {
  try {
    const user = await requireUser();

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
    });
    if (!existing) return { error: "Application not found" };
    if (existing.status !== "queued" && existing.status !== "approved") {
      return { error: `Cannot approve application with status "${existing.status}"` };
    }

    const application = await prisma.application.update({
      where: { id: applicationId },
      data: { status: "approved", coverLetter },
    });

    return { application };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to approve application" };
  }
}

export async function rejectFromQueue(applicationId: number) {
  try {
    const user = await requireUser();

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
    });
    if (!existing) return { error: "Application not found" };

    const application = await prisma.application.update({
      where: { id: applicationId },
      data: { status: "withdrawn" },
    });

    return { application };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reject application" };
  }
}

export async function bulkQueueFromSearch(
  searchProfileId: number,
  minScore: number
) {
  try {
    const user = await requireUser();

    // Verify search profile ownership
    const searchProfile = await prisma.searchProfile.findFirst({
      where: { id: searchProfileId, userId: user.id },
    });
    if (!searchProfile) return { error: "Search profile not found" };

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    // Find high-scoring vacancies not yet in any application
    const highScoring = await prisma.vacancyScore.findMany({
      where: {
        userId: user.id,
        searchProfileId,
        matchScore: { gte: minScore },
        vacancy: {
          applications: {
            none: { userId: user.id },
          },
        },
      },
      include: {
        vacancy: true,
      },
      orderBy: { matchScore: "desc" },
    });

    let queued = 0;

    for (const score of highScoring) {
      const vacancy = score.vacancy;
      const language = vacancy.language ?? undefined;

      let coverLetter: string | null = null;
      try {
        coverLetter = await generateCoverLetterAI(
          {
            title: vacancy.title,
            company: vacancy.company,
            description: vacancy.description,
          },
          {
            headline: userProfile.headline,
            summary: userProfile.summary,
            yearsExperience: userProfile.yearsExperience,
            skills: userProfile.skills,
          },
          language
        );
      } catch {
        // Continue without cover letter
      }

      await prisma.application.create({
        data: {
          userId: user.id,
          vacancyId: vacancy.id,
          searchProfileId,
          status: "queued",
          coverLetter,
        },
      });

      queued++;
    }

    return { queued };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to bulk queue" };
  }
}
