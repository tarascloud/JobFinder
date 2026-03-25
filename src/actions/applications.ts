"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

interface ApplicationFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export async function getApplications(filters?: ApplicationFilters) {
  try {
    const user = await requireUser();

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId: user.id,
      ...(filters?.status && { status: filters.status }),
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          vacancy: {
            select: {
              id: true,
              title: true,
              company: true,
              platform: true,
              url: true,
              location: true,
              remoteType: true,
              salaryText: true,
            },
          },
          searchProfile: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load applications" };
  }
}

export async function approveApplication(id: number) {
  try {
    const user = await requireUser();

    const existing = await prisma.application.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Application not found" };
    if (existing.status !== "queued") {
      return { error: `Cannot approve application with status "${existing.status}"` };
    }

    const application = await prisma.application.update({
      where: { id },
      data: { status: "approved" },
    });

    return application;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to approve application" };
  }
}

export async function rejectApplication(id: number) {
  try {
    const user = await requireUser();

    const existing = await prisma.application.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Application not found" };

    const application = await prisma.application.update({
      where: { id },
      data: { status: "withdrawn" },
    });

    return application;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reject application" };
  }
}

export async function getApplicationStats() {
  try {
    const user = await requireUser();

    const byStatus = await prisma.application.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const row of byStatus) {
      statusCounts[row.status] = row._count.id;
      total += row._count.id;
    }

    return {
      total,
      queued: statusCounts["queued"] ?? 0,
      approved: statusCounts["approved"] ?? 0,
      applied: statusCounts["applied"] ?? 0,
      withdrawn: statusCounts["withdrawn"] ?? 0,
      rejected: statusCounts["rejected"] ?? 0,
      interview: statusCounts["interview"] ?? 0,
      offer: statusCounts["offer"] ?? 0,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load application stats" };
  }
}
