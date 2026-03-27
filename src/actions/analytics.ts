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

    // Count vacancies per platform (only those scored for this user)
    const vacancyCounts = await prisma.$queryRaw<
      { platform: string; vacancies: bigint }[]
    >`
      SELECT v.platform, COUNT(DISTINCT v.id)::bigint AS vacancies
      FROM vacancies v
      INNER JOIN vacancy_scores vs ON vs.vacancy_id = v.id AND vs.user_id = ${user.id}
      GROUP BY v.platform
    `;

    // Count applied & responses per platform
    const appCounts = await prisma.$queryRaw<
      { platform: string; applied: bigint; responses: bigint }[]
    >`
      SELECT v.platform,
        COUNT(CASE WHEN a.status IN ('applied','response','interview','offer') THEN 1 END)::bigint AS applied,
        COUNT(CASE WHEN a.status IN ('response','interview','offer') THEN 1 END)::bigint AS responses
      FROM applications a
      INNER JOIN vacancies v ON v.id = a.vacancy_id
      WHERE a.user_id = ${user.id}
      GROUP BY v.platform
    `;

    const appMap = new Map(appCounts.map((r) => [r.platform, r]));

    return vacancyCounts.map((row) => {
      const app = appMap.get(row.platform);
      const vacancies = Number(row.vacancies);
      const applied = Number(app?.applied ?? 0);
      const responses = Number(app?.responses ?? 0);
      return {
        platform: row.platform,
        vacancies,
        applied,
        responses,
        responseRate: applied > 0 ? Math.round((responses / applied) * 100) : 0,
      };
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load platform stats" };
  }
}

export async function getTopCompanies() {
  try {
    const user = await requireUser();

    const rows = await prisma.$queryRaw<
      { company: string; vacancies: bigint; applied: bigint; avg_score: number | null }[]
    >`
      SELECT
        COALESCE(v.company, 'Unknown') AS company,
        COUNT(DISTINCT v.id)::bigint AS vacancies,
        COUNT(DISTINCT a.vacancy_id)::bigint AS applied,
        ROUND(AVG(vs.match_score)) AS avg_score
      FROM vacancies v
      INNER JOIN vacancy_scores vs ON vs.vacancy_id = v.id AND vs.user_id = ${user.id}
      LEFT JOIN applications a ON a.vacancy_id = v.id AND a.user_id = ${user.id}
      WHERE v.company IS NOT NULL
      GROUP BY COALESCE(v.company, 'Unknown')
      ORDER BY COUNT(DISTINCT v.id) DESC
      LIMIT 15
    `;

    return rows.map((row) => ({
      company: row.company,
      vacancies: Number(row.vacancies),
      applied: Number(row.applied),
      avgScore: row.avg_score != null ? Number(row.avg_score) : 0,
    }));
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

export async function getPlatformResponseRates() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["applied", "response", "interview", "offer", "rejected"] },
      },
      select: {
        status: true,
        vacancy: {
          select: { platform: true },
        },
      },
    });

    const platformMap = new Map<
      string,
      { applied: number; responses: number }
    >();

    for (const app of applications) {
      const platform = app.vacancy.platform;
      const existing = platformMap.get(platform) ?? { applied: 0, responses: 0 };
      existing.applied++;
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      platformMap.set(platform, existing);
    }

    return Array.from(platformMap.entries())
      .map(([platform, data]) => ({
        platform,
        applied: data.applied,
        responses: data.responses,
        responseRate: data.applied > 0 ? Math.round((data.responses / data.applied) * 100) : 0,
      }))
      .sort((a, b) => b.responseRate - a.responseRate);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load platform response rates" };
  }
}

export async function getBestTimeToApply() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        appliedAt: { not: null },
        status: { in: ["applied", "response", "interview", "offer", "rejected"] },
      },
      select: {
        appliedAt: true,
        status: true,
      },
    });

    const hourMap = new Map<number, { applied: number; responses: number }>();

    for (const app of applications) {
      if (!app.appliedAt) continue;
      const hour = new Date(app.appliedAt).getHours();
      const existing = hourMap.get(hour) ?? { applied: 0, responses: 0 };
      existing.applied++;
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      hourMap.set(hour, existing);
    }

    const result: { hour: number; applied: number; responses: number; responseRate: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const data = hourMap.get(h) ?? { applied: 0, responses: 0 };
      result.push({
        hour: h,
        applied: data.applied,
        responses: data.responses,
        responseRate: data.applied > 0 ? Math.round((data.responses / data.applied) * 100) : 0,
      });
    }

    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load best time analysis" };
  }
}

export async function getCompanyResponseRates() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["applied", "response", "interview", "offer", "rejected"] },
      },
      select: {
        status: true,
        vacancy: {
          select: { company: true },
        },
      },
    });

    const companyMap = new Map<
      string,
      { applied: number; responses: number }
    >();

    for (const app of applications) {
      const company = app.vacancy.company ?? "Unknown";
      const existing = companyMap.get(company) ?? { applied: 0, responses: 0 };
      existing.applied++;
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      companyMap.set(company, existing);
    }

    return Array.from(companyMap.entries())
      .map(([company, data]) => ({
        company,
        applied: data.applied,
        responses: data.responses,
        responseRate: data.applied > 0 ? Math.round((data.responses / data.applied) * 100) : 0,
      }))
      .filter((c) => c.applied >= 1)
      .sort((a, b) => b.responseRate - a.responseRate || b.applied - a.applied)
      .slice(0, 15);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load company response rates" };
  }
}

export async function getCoverLetterVariantStats() {
  try {
    const user = await requireUser();

    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        coverLetterVariant: { not: null },
        status: { in: ["applied", "response", "interview", "offer", "rejected"] },
      },
      select: {
        coverLetterVariant: true,
        status: true,
      },
    });

    const variantMap = new Map<
      string,
      { sent: number; responses: number }
    >();

    for (const app of applications) {
      const variant = app.coverLetterVariant!;
      const existing = variantMap.get(variant) ?? { sent: 0, responses: 0 };
      existing.sent++;
      if (["response", "interview", "offer"].includes(app.status)) {
        existing.responses++;
      }
      variantMap.set(variant, existing);
    }

    return Array.from(variantMap.entries())
      .map(([variant, data]) => ({
        variant,
        sent: data.sent,
        responses: data.responses,
        responseRate: data.sent > 0 ? Math.round((data.responses / data.sent) * 100) : 0,
      }))
      .sort((a, b) => b.responseRate - a.responseRate);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load variant stats" };
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
