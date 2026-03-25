"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { scoreVacancy } from "@/lib/ai/scorer";
import { generateCoverLetter as generateCoverLetterAI } from "@/lib/ai/cover-letter";

export async function scoreVacancies(
  searchProfileId: number
): Promise<{ scored: number; errors: number }> {
  const user = await requireUser();

  // Verify ownership of the search profile
  const searchProfile = await prisma.searchProfile.findFirst({
    where: { id: searchProfileId, userId: user.id },
  });
  if (!searchProfile) throw new Error("Search profile not found");

  // Get user profile
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });
  if (!userProfile) throw new Error("Please create your profile first");

  // Get unscored vacancies for this search profile (no VacancyScore record yet)
  const unscoredVacancies = await prisma.vacancy.findMany({
    where: {
      vacancyScores: {
        none: {
          userId: user.id,
          searchProfileId: searchProfileId,
        },
      },
    },
    take: 20,
    orderBy: { scrapedAt: "desc" },
  });

  let scored = 0;
  let errors = 0;

  for (const vacancy of unscoredVacancies) {
    try {
      const result = await scoreVacancy(
        {
          title: vacancy.title,
          company: vacancy.company,
          location: vacancy.location,
          description: vacancy.description,
          salaryText: vacancy.salaryText,
          remoteType: vacancy.remoteType,
        },
        {
          headline: userProfile.headline,
          summary: userProfile.summary,
          yearsExperience: userProfile.yearsExperience,
          skills: userProfile.skills,
        },
        {
          jobTitles: searchProfile.jobTitles,
          minSalary: searchProfile.minSalary,
          currency: searchProfile.currency,
          remoteOnly: searchProfile.remoteOnly,
          geographies: searchProfile.geographies,
        }
      );

      await prisma.vacancyScore.create({
        data: {
          vacancyId: vacancy.id,
          userId: user.id,
          searchProfileId: searchProfileId,
          matchScore: result.matchScore,
          salaryFit: result.salaryFit,
          remoteFit: result.remoteFit,
          notes: result.notes,
          scoredBy: "gemini-2.0-flash",
        },
      });

      scored++;
    } catch {
      errors++;
    }
  }

  return { scored, errors };
}

export async function generateCoverLetterAction(
  vacancyId: number,
  searchProfileId: number
): Promise<{ coverLetter?: string; error?: string }> {
  try {
    const user = await requireUser();

    // Get vacancy
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });
    if (!vacancy) return { error: "Vacancy not found" };

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    // Detect language from vacancy
    const language = vacancy.language ?? undefined;

    const coverLetter = await generateCoverLetterAI(
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

    // Save to application if one exists
    const existingApp = await prisma.application.findUnique({
      where: {
        userId_vacancyId: {
          userId: user.id,
          vacancyId: vacancyId,
        },
      },
    });

    if (existingApp) {
      await prisma.application.update({
        where: { id: existingApp.id },
        data: { coverLetter },
      });
    }

    return { coverLetter };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to generate cover letter",
    };
  }
}
