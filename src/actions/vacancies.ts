"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import type { Prisma } from "@/generated/prisma/client";
import { scoreVacancy } from "@/lib/ai/scorer";
import { generateCoverLetter as generateCoverLetterAI } from "@/lib/ai/cover-letter";

interface VacancyFilters {
  platform?: string;
  platforms?: string[];
  minScore?: number;
  status?: string;
  searchProfileId?: number;
  tagLevel?: string;
  tagIndustry?: string;
  tagStack?: string;
  page?: number;
  limit?: number;
}

export async function getVacancies(filters?: VacancyFilters) {
  try {
    const user = await requireUser();

    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build the where clause
    // When searchProfileId or minScore is set, filter by vacancyScores
    const hasScoreFilter = !!(filters?.searchProfileId || filters?.minScore);

    const scoreWhere: Prisma.VacancyScoreWhereInput = {
      userId: user.id,
      ...(filters?.searchProfileId && { searchProfileId: filters.searchProfileId }),
      ...(filters?.minScore && { matchScore: { gte: filters.minScore } }),
    };

    const vacancyWhere: Prisma.VacancyWhereInput = {
      ...(filters?.platforms && filters.platforms.length > 0 && { platform: { in: filters.platforms } }),
      ...(filters?.platform && !filters?.platforms && { platform: filters.platform }),
      // Only require vacancyScores when filtering by profile or minScore
      // Otherwise show ALL vacancies (including unscored ones)
      ...(hasScoreFilter && { vacancyScores: { some: scoreWhere } }),
      ...(filters?.status && {
        applications: {
          some: { userId: user.id, status: filters.status },
        },
      }),
      ...(filters?.tagLevel && { tagLevel: filters.tagLevel }),
      ...(filters?.tagIndustry && { tagIndustry: filters.tagIndustry }),
      ...(filters?.tagStack && { tagStack: { has: filters.tagStack } }),
    };

    const [vacancies, total] = await Promise.all([
      prisma.vacancy.findMany({
        where: vacancyWhere,
        include: {
          vacancyScores: {
            where: { userId: user.id },
            orderBy: { matchScore: "desc" },
            take: 1,
          },
          applications: {
            where: { userId: user.id },
            take: 1,
          },
        },
        orderBy: { scrapedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vacancy.count({ where: vacancyWhere }),
    ]);

    return {
      vacancies: vacancies.map((v) => ({
        id: v.id,
        platform: v.platform,
        url: v.url,
        title: v.title,
        company: v.company,
        location: v.location,
        description: v.description,
        salaryText: v.salaryText,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        salaryCurrency: v.salaryCurrency,
        salaryMinEur: v.salaryMinEur,
        salaryMaxEur: v.salaryMaxEur,
        remoteType: v.remoteType,
        employmentType: v.employmentType,
        postedAt: v.postedAt,
        scrapedAt: v.scrapedAt,
        matchScore: v.vacancyScores[0]?.matchScore ?? null,
        matchNotes: v.vacancyScores[0]?.notes ?? null,
        salaryFit: v.vacancyScores[0]?.salaryFit ?? null,
        remoteFit: v.vacancyScores[0]?.remoteFit ?? null,
        dismissed: v.vacancyScores[0]?.dismissed ?? false,
        applicationId: v.applications[0]?.id ?? null,
        applicationStatus: v.applications[0]?.status ?? null,
        appliedWithPersonalAccount: v.applications[0]?.appliedWithPersonalAccount ?? false,
        tagStack: v.tagStack,
        tagLevel: v.tagLevel,
        tagIndustry: v.tagIndustry,
        tagTeamSize: v.tagTeamSize,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load vacancies" };
  }
}

export async function getVacancyDetail(id: number) {
  try {
    const user = await requireUser();

    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: {
        vacancyScores: {
          where: { userId: user.id },
          include: { searchProfile: { select: { id: true, name: true } } },
          orderBy: { matchScore: "desc" },
        },
        applications: {
          where: { userId: user.id },
        },
        qaPairs: {
          where: { userId: user.id },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!vacancy) return { error: "Vacancy not found" };

    return {
      id: vacancy.id,
      platform: vacancy.platform,
      externalId: vacancy.externalId,
      url: vacancy.url,
      title: vacancy.title,
      company: vacancy.company,
      location: vacancy.location,
      salaryText: vacancy.salaryText,
      salaryMin: vacancy.salaryMin,
      salaryMax: vacancy.salaryMax,
      salaryCurrency: vacancy.salaryCurrency,
      remoteType: vacancy.remoteType,
      employmentType: vacancy.employmentType,
      description: vacancy.description,
      language: vacancy.language,
      postedAt: vacancy.postedAt,
      scrapedAt: vacancy.scrapedAt,
      scores: vacancy.vacancyScores.map((s) => ({
        id: s.id,
        matchScore: s.matchScore,
        salaryFit: s.salaryFit,
        remoteFit: s.remoteFit,
        notes: s.notes,
        scoredAt: s.scoredAt,
        scoredBy: s.scoredBy,
        searchProfile: s.searchProfile,
      })),
      application: vacancy.applications[0] ?? null,
      qaPairs: vacancy.qaPairs,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load vacancy" };
  }
}

export async function getVacancyStats() {
  try {
    const user = await requireUser();

    const [total, withApplication, byStatus] = await Promise.all([
      prisma.vacancyScore.count({ where: { userId: user.id } }),
      prisma.application.count({ where: { userId: user.id } }),
      prisma.application.groupBy({
        by: ["status"],
        where: { userId: user.id },
        _count: { id: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count.id;
    }

    return {
      totalScored: total,
      totalApplied: withApplication,
      queued: statusCounts["queued"] ?? 0,
      approved: statusCounts["approved"] ?? 0,
      applied: statusCounts["applied"] ?? 0,
      withdrawn: statusCounts["withdrawn"] ?? 0,
      rejected: statusCounts["rejected"] ?? 0,
      interview: statusCounts["interview"] ?? 0,
      offer: statusCounts["offer"] ?? 0,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load vacancy stats" };
  }
}

export async function batchScoreVacancies(
  ids: number[],
  searchProfileId: number
): Promise<{ scored: number; errors: number; error?: string }> {
  try {
    const user = await requireUser();

    const searchProfile = await prisma.searchProfile.findFirst({
      where: { id: searchProfileId, userId: user.id },
    });
    if (!searchProfile) return { scored: 0, errors: 0, error: "Search profile not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { scored: 0, errors: 0, error: "Please create your profile first" };

    // Get vacancies that haven't been scored for this search profile yet
    const vacancies = await prisma.vacancy.findMany({
      where: {
        id: { in: ids },
        vacancyScores: {
          none: {
            userId: user.id,
            searchProfileId,
          },
        },
      },
    });

    let scored = 0;
    let errors = 0;

    for (const vacancy of vacancies) {
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
            searchProfileId,
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
  } catch (e) {
    return { scored: 0, errors: 0, error: e instanceof Error ? e.message : "Failed to batch score" };
  }
}

export async function batchQueueVacancies(
  ids: number[],
  searchProfileId: number
): Promise<{ queued: number; errors: number; error?: string }> {
  try {
    const user = await requireUser();

    const searchProfile = await prisma.searchProfile.findFirst({
      where: { id: searchProfileId, userId: user.id },
    });
    if (!searchProfile) return { queued: 0, errors: 0, error: "Search profile not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { queued: 0, errors: 0, error: "Please create your profile first" };

    // Get vacancies that don't have an application yet
    const vacancies = await prisma.vacancy.findMany({
      where: {
        id: { in: ids },
        applications: {
          none: { userId: user.id },
        },
      },
    });

    let queued = 0;
    let errors = 0;

    for (const vacancy of vacancies) {
      try {
        const language = vacancy.language ?? undefined;
        let coverLetter: string | null = null;
        let coverLetterVariant: string | null = null;
        try {
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
          coverLetter = result.text;
          coverLetterVariant = result.variant;
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
            coverLetterVariant,
          },
        });

        queued++;
      } catch {
        errors++;
      }
    }

    return { queued, errors };
  } catch (e) {
    return { queued: 0, errors: 0, error: e instanceof Error ? e.message : "Failed to batch queue" };
  }
}

export async function batchDismissVacancies(
  ids: number[]
): Promise<{ dismissed: number; error?: string }> {
  try {
    const user = await requireUser();

    const result = await prisma.vacancyScore.updateMany({
      where: {
        userId: user.id,
        vacancyId: { in: ids },
      },
      data: { dismissed: true },
    });

    return { dismissed: result.count };
  } catch (e) {
    return { dismissed: 0, error: e instanceof Error ? e.message : "Failed to dismiss vacancies" };
  }
}
