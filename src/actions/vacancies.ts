"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { Prisma } from "@/generated/prisma/client";
import { scoreVacancy } from "@/lib/ai/scorer";
import { generateCoverLetter as generateCoverLetterAI } from "@/lib/ai/cover-letter";

interface VacancyFilters {
  platform?: string;
  platforms?: string[];
  minScore?: number;
  status?: string;
  searchProfileId?: number;
  searchProfileIds?: number[];
  tagLevel?: string;
  tagIndustry?: string;
  tagStack?: string;
  page?: number;
  limit?: number;
  cursor?: number;
}

export async function getVacancies(filters?: VacancyFilters) {
  try {
    const user = await requireUser();

    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = filters?.cursor ? 0 : (page - 1) * limit;

    // Build UserVacancy where clause — only show scored vacancies (JF-V5.4)
    const uvWhere: Prisma.UserVacancyWhereInput = {
      userId: user.id,
      dismissed: false,
      // Hide unscored: score=0 AND scoredAt IS NULL
      NOT: {
        AND: [
          { score: 0 },
          { scoredAt: null },
        ],
      },
      ...(filters?.searchProfileId && { searchProfileId: filters.searchProfileId }),
      ...(filters?.searchProfileIds && filters.searchProfileIds.length > 0 && {
        searchProfileId: { in: filters.searchProfileIds },
      }),
      ...(filters?.minScore && { score: { gte: filters.minScore } }),
      ...(filters?.cursor && { id: { lt: filters.cursor } }),
    };

    // Build vacancy-level filters
    const vacancyWhere: Prisma.VacancyWhereInput = {
      ...(filters?.platforms && filters.platforms.length > 0 && { platform: { in: filters.platforms } }),
      ...(filters?.platform && !filters?.platforms && { platform: filters.platform }),
      ...(filters?.status && {
        applications: {
          some: { userId: user.id, status: filters.status },
        },
      }),
      ...(filters?.tagLevel && { tagLevel: filters.tagLevel }),
      ...(filters?.tagIndustry && { tagIndustry: filters.tagIndustry }),
      ...(filters?.tagStack && { tagStack: { has: filters.tagStack } }),
    };

    // Combine: filter UserVacancy with nested vacancy conditions
    const combinedWhere: Prisma.UserVacancyWhereInput = {
      ...uvWhere,
      vacancy: vacancyWhere,
    };

    const [userVacancies, total] = await Promise.all([
      prisma.userVacancy.findMany({
        where: combinedWhere,
        include: {
          vacancy: {
            include: {
              applications: {
                where: { userId: user.id },
                take: 1,
              },
            },
          },
        },
        orderBy: { score: "desc" },
        skip,
        take: limit,
      }),
      prisma.userVacancy.count({ where: combinedWhere }),
    ]);

    return {
      vacancies: userVacancies.map((uv) => {
        const v = uv.vacancy;
        return {
          id: v.id,
          userVacancyId: uv.id,
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
          matchScore: uv.score,
          matchNotes: uv.scoreNotes,
          salaryFit: uv.salaryFit,
          remoteFit: uv.remoteFit,
          dismissed: uv.dismissed,
          seen: uv.seen,
          savedAt: uv.savedAt,
          scoredAt: uv.scoredAt,
          applicationId: v.applications[0]?.id ?? null,
          applicationStatus: v.applications[0]?.status ?? null,
          appliedWithPersonalAccount: v.applications[0]?.appliedWithPersonalAccount ?? false,
          tagStack: v.tagStack,
          tagLevel: v.tagLevel,
          tagIndustry: v.tagIndustry,
          tagTeamSize: v.tagTeamSize,
        };
      }),
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
        userVacancies: {
          where: { userId: user.id },
          include: { searchProfile: { select: { id: true, name: true } } },
        },
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

    const uv = vacancy.userVacancies[0];

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
      matchScore: uv?.score ?? vacancy.vacancyScores[0]?.matchScore ?? null,
      matchNotes: uv?.scoreNotes ?? vacancy.vacancyScores[0]?.notes ?? null,
      seen: uv?.seen ?? true,
      dismissed: uv?.dismissed ?? false,
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
      prisma.userVacancy.count({
        where: {
          userId: user.id,
          NOT: { AND: [{ score: 0 }, { scoredAt: null }] },
        },
      }),
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
            detailedAnalysis: (result.detailedAnalysis as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
            scoredBy: "gemini-2.0-flash",
          },
        });

        // Also update UserVacancy
        await prisma.userVacancy.upsert({
          where: {
            userId_vacancyId: { userId: user.id, vacancyId: vacancy.id },
          },
          update: {
            score: result.matchScore,
            salaryFit: result.salaryFit,
            remoteFit: result.remoteFit,
            scoreNotes: result.notes,
            scoredAt: new Date(),
            scoredBy: "gemini-2.0-flash",
            searchProfileId,
          },
          create: {
            userId: user.id,
            vacancyId: vacancy.id,
            searchProfileId,
            score: result.matchScore,
            salaryFit: result.salaryFit,
            remoteFit: result.remoteFit,
            scoreNotes: result.notes,
            scoredAt: new Date(),
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

        // Mark as saved in UserVacancy
        await prisma.userVacancy.updateMany({
          where: { userId: user.id, vacancyId: vacancy.id },
          data: { savedAt: new Date() },
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

    // Update UserVacancy records
    const result = await prisma.userVacancy.updateMany({
      where: {
        userId: user.id,
        vacancyId: { in: ids },
      },
      data: { dismissed: true },
    });

    // Also update legacy VacancyScore records
    await prisma.vacancyScore.updateMany({
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

export async function getNewVacanciesCount(): Promise<number> {
  try {
    const user = await requireUser();
    return prisma.userVacancy.count({
      where: {
        userId: user.id,
        seen: false,
        NOT: { AND: [{ score: 0 }, { scoredAt: null }] },
      },
    });
  } catch {
    return 0;
  }
}

export async function markVacanciesAsSeen(searchProfileId?: number): Promise<{ success: boolean; marked?: number; error?: string }> {
  try {
    const user = await requireUser();

    const [, result] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { lastVacanciesSeenAt: new Date() },
      }),
      prisma.userVacancy.updateMany({
        where: {
          userId: user.id,
          seen: false,
          ...(searchProfileId && { searchProfileId }),
        },
        data: { seen: true },
      }),
    ]);

    return { success: true, marked: result.count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to mark vacancies as seen" };
  }
}

export async function saveVacancy(vacancyId: number) {
  try {
    const user = await requireUser();

    await prisma.userVacancy.updateMany({
      where: { userId: user.id, vacancyId },
      data: { savedAt: new Date() },
    });

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save vacancy" };
  }
}

export async function dismissVacancy(vacancyId: number) {
  try {
    const user = await requireUser();

    await prisma.userVacancy.updateMany({
      where: { userId: user.id, vacancyId },
      data: { dismissed: true },
    });

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to dismiss vacancy" };
  }
}
