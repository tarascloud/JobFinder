import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { scrapePlatform } from "@/lib/scrapers";
import type { ScrapedVacancy, SearchCriteria } from "@/lib/scrapers/types";
import { checkRateLimit } from "@/lib/rate-limiter";
import { saveVacancy, loadExistingVacanciesForDedup } from "@/lib/save-vacancy";

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
  "dou",
  "workua",
  "robotaua",
  "ziprecruiter",
  "dice",
  "simplyhired",
  "arcdev",
  "himalayas",
  "infojobs",
  "tecnoempleo",
  "jobatus",
  "computrabajo",
  // Disabled: stackoverflow (shut down March 2022), google-jobs (CAPTCHA blocked)
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

  // Rate limit: max 3 scrapes per hour per user
  const rateCheck = checkRateLimit(user.id, "scrape", 3);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: rateCheck.retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter),
        },
      }
    );
  }

  let body: { searchProfileId?: number; platforms?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchProfileId } = body;
  const requestedPlatforms = body.platforms;
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
        const existingVacancies = await loadExistingVacanciesForDedup(user.id);

        let totalNew = 0;
        let totalDuplicates = 0;
        const allScraped: ScrapedVacancy[] = [];

        // Filter platforms if user selected specific ones
        const platformsToScrape = requestedPlatforms && requestedPlatforms.length > 0
          ? PLATFORMS.filter((p) => requestedPlatforms.includes(p))
          : PLATFORMS;

        // Scrape platforms sequentially, streaming progress
        for (const platform of platformsToScrape) {
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
            const { result } = await saveVacancy(
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

        // Auto-score new vacancies with AI
        if (totalNew > 0) {
          send({ type: "scoring", total: totalNew });
          try {
            const { scoreVacancy } = await import("@/lib/ai/scorer");
            const userProfile = await prisma.userProfile.findUnique({ where: { userId: user.id } });

            const unscored = await prisma.vacancyScore.findMany({
              where: { userId: user.id, searchProfileId: searchProfile.id, matchScore: 0 },
              include: { vacancy: true },
              take: 20,
            });

            let scored = 0;
            for (const vs of unscored) {
              try {
                const result = await scoreVacancy(
                  { title: vs.vacancy.title, company: vs.vacancy.company || "", description: vs.vacancy.description, salaryText: vs.vacancy.salaryText },
                  { headline: userProfile?.headline || "", skills: userProfile?.skills || [], yearsExperience: userProfile?.yearsExperience || 0, summary: userProfile?.summary || "" },
                  { jobTitles: searchProfile.jobTitles, minSalary: searchProfile.minSalary || 0, currency: searchProfile.currency || "EUR", remoteOnly: searchProfile.remoteOnly, geographies: searchProfile.geographies },
                  { userId: user.id }
                );
                await prisma.vacancyScore.update({
                  where: { id: vs.id },
                  data: { matchScore: result.matchScore, salaryFit: result.salaryFit, remoteFit: result.remoteFit, notes: result.notes, detailedAnalysis: (result.detailedAnalysis as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull, scoredBy: "groq", scoredAt: new Date() },
                });
                scored++;
              } catch (e) {
                console.error("[scrape-stream] Score error:", e instanceof Error ? e.message : e);
              }
            }
            send({ type: "scored", count: scored });
          } catch (e) {
            console.error("[scrape-stream] Auto-scoring failed:", e instanceof Error ? e.message : e);
          }
        }
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

