import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { scrapePlatform } from "@/lib/scrapers";
import type { ScrapedVacancy, SearchCriteria } from "@/lib/scrapers/types";
import { findDuplicate } from "@/lib/dedup";
import { computeEurSalary } from "@/lib/salary";
import { tagVacancy } from "@/lib/ai/tagger";

// Re-export scrapers list for sequential streaming
const PLATFORMS = [
  "remoteok",
  "weworkremotely",
  "indeed",
  "linkedin",
  "glassdoor",
  "wellfound",
  "hn-whohiring",
  "djinni",
  "stackoverflow",
  "ziprecruiter",
  "google-jobs",
];

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { searchProfileId?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchProfileId } = body;
  if (!searchProfileId) {
    return new Response(JSON.stringify({ error: "searchProfileId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const searchProfile = await prisma.searchProfile.findFirst({
    where: { id: searchProfileId, userId: user.id },
  });
  if (!searchProfile) {
    return new Response(JSON.stringify({ error: "Search profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const criteria: SearchCriteria = {
    jobTitles: searchProfile.jobTitles,
    geographies: searchProfile.geographies,
    remoteOnly: searchProfile.remoteOnly,
    minSalary: searchProfile.minSalary ?? 0,
    currency: searchProfile.currency ?? "EUR",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        // Load existing vacancies for cross-platform dedup
        const existingVacancies = await prisma.vacancy.findMany({
          where: { vacancyScores: { some: { userId: user.id } } },
          select: { id: true, company: true, title: true, postedAt: true },
        });

        let totalNew = 0;
        let totalDuplicates = 0;
        const allScraped: ScrapedVacancy[] = [];

        // Scrape platforms sequentially, streaming progress
        for (const platform of PLATFORMS) {
          send({ type: "platform_start", platform });

          let results: ScrapedVacancy[] = [];
          try {
            results = await scrapePlatform(platform, criteria);
          } catch (err) {
            console.error(
              `[scrape-stream] ${platform} error:`,
              err instanceof Error ? err.message : err
            );
          }

          allScraped.push(...results);
          send({ type: "platform_done", platform, count: results.length });
        }

        // Save phase
        send({ type: "saving", total: allScraped.length });

        for (const vacancy of allScraped) {
          try {
            const result = await saveVacancyWithTags(
              vacancy,
              user.id,
              searchProfileId,
              existingVacancies
            );
            if (result === "new") {
              totalNew++;
            } else {
              totalDuplicates++;
            }
          } catch (err) {
            console.error(
              `[scrape-stream] Save error:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        send({
          type: "done",
          totalNew,
          totalDuplicates,
          totalScraped: allScraped.length,
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// --- Save vacancy (same as scraper.ts but with auto-tagging) ---

interface ExistingVacancyForDedup {
  id: number;
  company: string | null;
  title: string;
  postedAt: Date | null;
}

async function saveVacancyWithTags(
  vacancy: ScrapedVacancy,
  userId: number,
  searchProfileId: number,
  existingVacancies: ExistingVacancyForDedup[]
): Promise<"new" | "duplicate" | "cross-platform-dup"> {
  // Step 1: Check exact platform + externalId dedup
  const existing = await prisma.vacancy.findUnique({
    where: {
      platform_externalId: {
        platform: vacancy.platform,
        externalId: vacancy.externalId,
      },
    },
  });

  if (existing) {
    await ensureVacancyScore(existing.id, userId, searchProfileId);
    // Backfill tags if missing
    if (!existing.tagLevel) {
      const tags = tagVacancy(
        existing.title,
        existing.company ?? "",
        existing.description
      );
      await prisma.vacancy.update({
        where: { id: existing.id },
        data: {
          tagStack: tags.stack,
          tagLevel: tags.level,
          tagIndustry: tags.industry,
          tagTeamSize: tags.teamSize,
        },
      });
    }
    return "duplicate";
  }

  // Step 2: Smart cross-platform dedup
  const duplicateOfId = findDuplicate(vacancy, existingVacancies);

  // Compute EUR-normalized salary
  const eurSalary = computeEurSalary(
    vacancy.salaryMin,
    vacancy.salaryMax,
    vacancy.salaryCurrency,
    vacancy.salaryText
  );

  // Auto-tag
  const tags = tagVacancy(
    vacancy.title,
    vacancy.company ?? "",
    vacancy.description || ""
  );

  const created = await prisma.vacancy.create({
    data: {
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
      salaryMinEur: eurSalary.minEur,
      salaryMaxEur: eurSalary.maxEur,
      remoteType: vacancy.remoteType,
      employmentType: vacancy.employmentType,
      description: vacancy.description || "",
      language: vacancy.language,
      postedAt: vacancy.postedAt,
      isDuplicateOf: duplicateOfId,
      tagStack: tags.stack,
      tagLevel: tags.level,
      tagIndustry: tags.industry,
      tagTeamSize: tags.teamSize,
    },
  });

  existingVacancies.push({
    id: created.id,
    company: vacancy.company,
    title: vacancy.title,
    postedAt: vacancy.postedAt,
  });

  if (duplicateOfId) {
    return "cross-platform-dup";
  }

  await prisma.vacancyScore.create({
    data: {
      vacancyId: created.id,
      userId,
      searchProfileId,
      matchScore: 0,
      scoredBy: "scraper",
    },
  });

  return "new";
}

async function ensureVacancyScore(
  vacancyId: number,
  userId: number,
  searchProfileId: number
) {
  const existingScore = await prisma.vacancyScore.findFirst({
    where: { vacancyId, userId, searchProfileId },
  });

  if (!existingScore) {
    await prisma.vacancyScore.create({
      data: {
        vacancyId,
        userId,
        searchProfileId,
        matchScore: 0,
        scoredBy: "scraper",
      },
    });
  }
}
