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

  // Get unscored vacancies — either no score record OR score is 0 (placeholder from scraper)
  const unscoredScores = await prisma.vacancyScore.findMany({
    where: {
      userId: user.id,
      searchProfileId: searchProfileId,
      matchScore: 0,
    },
    include: { vacancy: true },
    take: 20,
    orderBy: { vacancy: { scrapedAt: "desc" } },
  });
  const unscoredVacancies = unscoredScores.map(s => s.vacancy);

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
        },
        { userId: user.id }
      );

      // Find and update existing score record (created by scraper with matchScore=0)
      const existingScore = unscoredScores.find(s => s.vacancyId === vacancy.id);
      if (existingScore) {
        await prisma.vacancyScore.update({
          where: { id: existingScore.id },
          data: {
            matchScore: result.matchScore,
            salaryFit: result.salaryFit,
            remoteFit: result.remoteFit,
            notes: result.notes,
            scoredBy: "groq",
            scoredAt: new Date(),
          },
        });
      } else {
        await prisma.vacancyScore.create({
          data: {
            vacancyId: vacancy.id,
            userId: user.id,
            searchProfileId: searchProfileId,
            matchScore: result.matchScore,
            salaryFit: result.salaryFit,
            remoteFit: result.remoteFit,
            notes: result.notes,
            scoredBy: "groq",
          },
        });
      }

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

    const result = await generateCoverLetterAI(
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
      language,
      undefined,
      { userId: user.id }
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
        data: { coverLetter: result.text, coverLetterVariant: result.variant },
      });
    }

    return { coverLetter: result.text };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to generate cover letter",
    };
  }
}
