import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeAll } from "@/lib/scrapers";
import { scoreVacancy } from "@/lib/ai/scorer";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active search profiles with user profiles
    const searchProfiles = await prisma.searchProfile.findMany({
      where: { isActive: true },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    if (searchProfiles.length === 0) {
      return NextResponse.json({ scraped: 0, scored: 0, message: "No active search profiles" });
    }

    let totalScraped = 0;
    let totalScored = 0;
    let totalAutoQueued = 0;

    for (const sp of searchProfiles) {
      // Scrape vacancies for this search profile
      const vacancies = await scrapeAll({
        jobTitles: sp.jobTitles,
        geographies: sp.geographies,
        remoteOnly: sp.remoteOnly,
        minSalary: sp.minSalary ?? 0,
        currency: sp.currency ?? "EUR",
      });

      // Save and dedup vacancies
      for (const v of vacancies) {
        const vacancy = await prisma.vacancy.upsert({
          where: {
            platform_externalId: {
              platform: v.platform,
              externalId: v.externalId,
            },
          },
          update: {
            title: v.title,
            company: v.company,
            location: v.location,
            salaryText: v.salaryText,
            salaryMin: v.salaryMin,
            salaryMax: v.salaryMax,
            salaryCurrency: v.salaryCurrency,
            remoteType: v.remoteType,
            employmentType: v.employmentType,
            description: v.description,
            language: v.language,
            postedAt: v.postedAt,
          },
          create: {
            platform: v.platform,
            externalId: v.externalId,
            url: v.url,
            title: v.title,
            company: v.company,
            location: v.location,
            salaryText: v.salaryText,
            salaryMin: v.salaryMin,
            salaryMax: v.salaryMax,
            salaryCurrency: v.salaryCurrency,
            remoteType: v.remoteType,
            employmentType: v.employmentType,
            description: v.description,
            language: v.language,
            postedAt: v.postedAt,
          },
        });

        totalScraped++;

        // Check if already scored for this user + search profile
        const existingScore = await prisma.vacancyScore.findFirst({
          where: {
            vacancyId: vacancy.id,
            userId: sp.userId,
            searchProfileId: sp.id,
          },
        });

        if (!existingScore && sp.user.profile) {
          try {
            const score = await scoreVacancy(
              vacancy,
              {
                headline: sp.user.profile.headline,
                summary: sp.user.profile.summary,
                yearsExperience: sp.user.profile.yearsExperience,
                skills: sp.user.profile.skills,
              },
              {
                jobTitles: sp.jobTitles,
                minSalary: sp.minSalary,
                currency: sp.currency,
                remoteOnly: sp.remoteOnly,
                geographies: sp.geographies,
              }
            );

            await prisma.vacancyScore.create({
              data: {
                vacancyId: vacancy.id,
                userId: sp.userId,
                searchProfileId: sp.id,
                matchScore: score.matchScore,
                salaryFit: score.salaryFit,
                remoteFit: score.remoteFit,
                notes: score.notes,
                scoredBy: "gemini-auto",
              },
            });

            totalScored++;

            // Auto-apply: if profile has autoApply enabled and score >= 70
            if (sp.autoApply && score.matchScore >= 70) {
              // Check not already queued/applied
              const existingApp = await prisma.application.findUnique({
                where: {
                  userId_vacancyId: {
                    userId: sp.userId,
                    vacancyId: vacancy.id,
                  },
                },
              });

              if (!existingApp && sp.user.profile) {
                let coverLetter: string | null = null;
                try {
                  coverLetter = await generateCoverLetter(
                    {
                      title: vacancy.title,
                      company: vacancy.company,
                      description: vacancy.description,
                    },
                    {
                      headline: sp.user.profile.headline,
                      summary: sp.user.profile.summary,
                      yearsExperience: sp.user.profile.yearsExperience,
                      skills: sp.user.profile.skills,
                    },
                    vacancy.language ?? undefined
                  );
                } catch {
                  // Continue without cover letter
                }

                await prisma.application.create({
                  data: {
                    userId: sp.userId,
                    vacancyId: vacancy.id,
                    searchProfileId: sp.id,
                    status: "approved",
                    coverLetter,
                  },
                });

                totalAutoQueued++;
              }
            }
          } catch (err) {
            console.error(
              `[scrape] Failed to score vacancy ${vacancy.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }
      }
    }

    const summaryParts = [
      `Found ${totalScraped} vacancies, scored ${totalScored} new matches`,
    ];
    if (totalAutoQueued > 0) {
      summaryParts.push(`Auto-approved ${totalAutoQueued} for apply`);
    }
    const summary = summaryParts.join(". ");
    console.log(`[scrape] ${summary}`);

    await sendTelegramNotification(
      `<b>JobFinder Scrape</b>\n${summary}\nProfiles: ${searchProfiles.length}`
    );

    // Create in-app notifications per user
    const userIds = [...new Set(searchProfiles.map((sp) => sp.userId))];
    for (const userId of userIds) {
      if (totalScraped > 0) {
        await createNotification(
          userId,
          "scrape_complete",
          `Found ${totalScraped} new vacancies`,
          summary,
          "/vacancies"
        );
      }
    }

    return NextResponse.json({
      scraped: totalScraped,
      scored: totalScored,
      autoQueued: totalAutoQueued,
      profiles: searchProfiles.length,
    });
  } catch (error) {
    console.error("[scrape] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
