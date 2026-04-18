import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { verifyCronSecret } from "@/lib/api-auth";
import { scoreVacancy } from "@/lib/ai/scorer";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";

const BATCH_SIZE = parseInt(process.env.SCORE_BATCH_SIZE || "5", 10);

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find UserVacancy records where score=0 and scoredAt IS NULL
    const unscored = await prisma.userVacancy.findMany({
      where: {
        score: 0,
        scoredAt: null,
      },
      include: {
        vacancy: true,
        user: {
          include: {
            profile: true,
          },
        },
        searchProfile: true,
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (unscored.length === 0) {
      const remaining = await prisma.userVacancy.count({
        where: { score: 0, scoredAt: null },
      });
      return NextResponse.json({
        scored: 0,
        failed: 0,
        remaining,
        message: "No unscored vacancies",
      });
    }

    let scored = 0;
    let failed = 0;
    const highScoreVacancies: {
      title: string;
      company: string;
      score: number;
      userId: number;
    }[] = [];

    for (const uv of unscored) {
      try {
        const { vacancy, user, searchProfile } = uv;
        const userProfile = user.profile;

        if (!userProfile) {
          console.log(
            `[score-batch] Skipping UV ${uv.id} — user ${user.id} has no profile`
          );
          // Mark as scored with 0 to avoid re-processing
          await prisma.userVacancy.update({
            where: { id: uv.id },
            data: {
              scoredAt: new Date(),
              scoredBy: "batch-skip",
              scoreNotes: "No user profile",
            },
          });
          failed++;
          continue;
        }

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
            jobTitles: searchProfile?.jobTitles ?? [],
            minSalary: searchProfile?.minSalary ?? null,
            currency: searchProfile?.currency ?? null,
            remoteOnly: searchProfile?.remoteOnly ?? false,
            geographies: searchProfile?.geographies ?? [],
          },
          { userId: user.id }
        );

        await prisma.userVacancy.update({
          where: { id: uv.id },
          data: {
            score: result.matchScore,
            salaryFit: result.salaryFit,
            remoteFit: result.remoteFit,
            scoreNotes: result.notes,
            scoredAt: new Date(),
            scoredBy: "batch",
          },
        });

        // Also persist detailed analysis to VacancyScore if it exists
        if (result.detailedAnalysis) {
          const existingVacancyScore = await prisma.vacancyScore.findFirst({
            where: {
              vacancyId: uv.vacancyId,
              userId: uv.userId,
              ...(uv.searchProfileId ? { searchProfileId: uv.searchProfileId } : {}),
            },
          });
          if (existingVacancyScore) {
            await prisma.vacancyScore.update({
              where: { id: existingVacancyScore.id },
              data: {
                matchScore: result.matchScore,
                salaryFit: result.salaryFit,
                remoteFit: result.remoteFit,
                notes: result.notes,
                detailedAnalysis: result.detailedAnalysis as unknown as Prisma.InputJsonValue,
                scoredBy: "batch",
                scoredAt: new Date(),
              },
            });
          }
        }

        scored++;

        if (result.matchScore > 80) {
          highScoreVacancies.push({
            title: vacancy.title,
            company: vacancy.company ?? "Unknown",
            score: result.matchScore,
            userId: user.id,
          });
        }
      } catch (err) {
        console.error(
          `[score-batch] Error scoring UV ${uv.id}:`,
          err instanceof Error ? err.message : err
        );
        failed++;
      }
    }

    // Count remaining unscored
    const remaining = await prisma.userVacancy.count({
      where: { score: 0, scoredAt: null },
    });

    // Telegram notifications for high-score vacancies
    if (highScoreVacancies.length > 0) {
      const lines = highScoreVacancies.map(
        (v) => `  \u{1F3AF} ${v.title} at ${v.company} \u2014 ${v.score}% match`
      );
      const message = [
        `<b>JobFinder Scoring</b>`,
        `High-match vacancies found:`,
        ...lines,
        ``,
        `Scored: ${scored}, Failed: ${failed}, Remaining: ${remaining}`,
      ].join("\n");

      await sendTelegramNotification(message);

      // In-app notifications per user
      const userIds = [...new Set(highScoreVacancies.map((v) => v.userId))];
      for (const userId of userIds) {
        const userHighScores = highScoreVacancies.filter(
          (v) => v.userId === userId
        );
        await createNotification(
          userId,
          "high_score",
          `${userHighScores.length} high-match ${userHighScores.length === 1 ? "vacancy" : "vacancies"} found`,
          userHighScores
            .map((v) => `${v.title} at ${v.company} (${v.score}%)`)
            .join(", "),
          "/vacancies"
        );
      }
    }

    return NextResponse.json({
      scored,
      failed,
      remaining,
    });
  } catch (error) {
    console.error("[score-batch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
