"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function getApplicationFunnel() {
  try {
    const user = await requireUser();

    const byStatus = await prisma.application.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const row of byStatus) {
      counts[row.status] = row._count.id;
    }

    return {
      queued: counts["queued"] ?? 0,
      approved: counts["approved"] ?? 0,
      applied: counts["applied"] ?? 0,
      response: counts["response"] ?? 0,
      interview: counts["interview"] ?? 0,
      offer: counts["offer"] ?? 0,
      rejected: counts["rejected"] ?? 0,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load funnel" };
  }
}

export async function getWeeklyApplicationStats(weeks: number = 8) {
  try {
    const user = await requireUser();

    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    // Group by ISO week
    const weekMap = new Map<string, { applied: number; responses: number; interviews: number }>();

    for (const app of applications) {
      const d = new Date(app.createdAt);
      const week = getISOWeek(d);
      const existing = weekMap.get(week) ?? { applied: 0, responses: 0, interviews: 0 };

      if (["applied", "response", "interview", "offer"].includes(app.status)) {
        existing.applied++;
      }
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      if (["interview", "offer"].includes(app.status)) {
        existing.interviews++;
      }

      weekMap.set(week, existing);
    }

    // Fill missing weeks
    const result: { week: string; applied: number; responses: number; interviews: number }[] = [];
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i * 7);
      const week = getISOWeek(d);
      const data = weekMap.get(week) ?? { applied: 0, responses: 0, interviews: 0 };
      if (!result.find((r) => r.week === week)) {
        result.push({ week, ...data });
      }
    }

    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load weekly stats" };
  }
}

export async function getPlatformStats() {
  try {
    const user = await requireUser();

    const vacancies = await prisma.vacancy.findMany({
      where: {
        vacancyScores: { some: { userId: user.id } },
      },
      select: {
        platform: true,
        applications: {
          where: { userId: user.id },
          select: { status: true },
        },
      },
    });

    const platformMap = new Map<
      string,
      { vacancies: number; applied: number; responses: number }
    >();

    for (const v of vacancies) {
      const existing = platformMap.get(v.platform) ?? {
        vacancies: 0,
        applied: 0,
        responses: 0,
      };
      existing.vacancies++;

      for (const app of v.applications) {
        if (["applied", "response", "interview", "offer"].includes(app.status)) {
          existing.applied++;
        }
        if (["response", "interview", "offer"].includes(app.status)) {
          existing.responses++;
        }
      }

      platformMap.set(v.platform, existing);
    }

    return Array.from(platformMap.entries()).map(([platform, data]) => ({
      platform,
      vacancies: data.vacancies,
      applied: data.applied,
      responses: data.responses,
      responseRate: data.applied > 0 ? Math.round((data.responses / data.applied) * 100) : 0,
    }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load platform stats" };
  }
}

export async function getTopCompanies() {
  try {
    const user = await requireUser();

    const vacancies = await prisma.vacancy.findMany({
      where: {
        vacancyScores: { some: { userId: user.id } },
        company: { not: null },
      },
      select: {
        company: true,
        vacancyScores: {
          where: { userId: user.id },
          select: { matchScore: true },
          take: 1,
          orderBy: { matchScore: "desc" },
        },
        applications: {
          where: { userId: user.id },
          select: { status: true },
        },
      },
    });

    const companyMap = new Map<
      string,
      { vacancies: number; applied: number; totalScore: number; scoreCount: number }
    >();

    for (const v of vacancies) {
      const company = v.company ?? "Unknown";
      const existing = companyMap.get(company) ?? {
        vacancies: 0,
        applied: 0,
        totalScore: 0,
        scoreCount: 0,
      };
      existing.vacancies++;
      if (v.applications.length > 0) existing.applied++;
      if (v.vacancyScores[0]) {
        existing.totalScore += v.vacancyScores[0].matchScore;
        existing.scoreCount++;
      }
      companyMap.set(company, existing);
    }

    return Array.from(companyMap.entries())
      .map(([company, data]) => ({
        company,
        vacancies: data.vacancies,
        applied: data.applied,
        avgScore: data.scoreCount > 0 ? Math.round(data.totalScore / data.scoreCount) : 0,
      }))
      .sort((a, b) => b.vacancies - a.vacancies)
      .slice(0, 15);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load top companies" };
  }
}

export async function getScoreDistribution() {
  try {
    const user = await requireUser();

    const scores = await prisma.vacancyScore.findMany({
      where: { userId: user.id },
      select: { matchScore: true },
    });

    const ranges = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];

    for (const s of scores) {
      for (const r of ranges) {
        if (s.matchScore >= r.min && s.matchScore <= r.max) {
          r.count++;
          break;
        }
      }
    }

    return ranges.map(({ range, count }) => ({ range, count }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load score distribution" };
  }
}

export async function getApplyTimeAnalysis() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        appliedAt: { not: null },
      },
      select: {
        appliedAt: true,
        status: true,
      },
    });

    const hourMap = new Map<number, { applications: number; responses: number }>();

    for (const app of applications) {
      if (!app.appliedAt) continue;
      const hour = new Date(app.appliedAt).getHours();
      const existing = hourMap.get(hour) ?? { applications: 0, responses: 0 };
      existing.applications++;
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      hourMap.set(hour, existing);
    }

    const result: { hour: number; applications: number; responses: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const data = hourMap.get(h) ?? { applications: 0, responses: 0 };
      result.push({ hour: h, ...data });
    }

    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load apply time analysis" };
  }
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
