"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Forbidden: owner access required");
  return user;
}

export async function getUsers() {
  await requireOwner();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      applicationLimit: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { users };
}

export async function updateApplicationLimit(userId: number, limit: number) {
  await requireOwner();

  if (limit < 1 || limit > 100 || !Number.isInteger(limit)) {
    return { error: "Limit must be an integer between 1 and 100." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { applicationLimit: limit },
  });

  return { ok: true };
}

export async function changeUserRole(userId: number, role: string) {
  const owner = await requireOwner();

  if (!["owner", "user", "guest"].includes(role)) {
    return { error: "Invalid role. Must be owner, user, or guest." };
  }

  if (userId === owner.id) {
    return { error: "Cannot change your own role." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return { ok: true };
}

export async function removeUser(userId: number) {
  const owner = await requireOwner();

  if (userId === owner.id) {
    return { error: "Cannot remove yourself." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}

export async function getUserStats(userId: number) {
  await requireOwner();

  const [vacancyCount, applicationsByStatus, searchProfileCount, lastActivity] =
    await Promise.all([
      prisma.vacancyScore.count({ where: { userId } }),
      prisma.application.groupBy({
        by: ["status"],
        where: { userId },
        _count: { id: true },
      }),
      prisma.searchProfile.count({ where: { userId } }),
      prisma.application
        .findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        .then((a) => a?.createdAt ?? null),
    ]);

  const statusCounts: Record<string, number> = {};
  for (const row of applicationsByStatus) {
    statusCounts[row.status] = row._count.id;
  }

  return {
    vacancyCount,
    applicationsByStatus: statusCounts,
    totalApplications: Object.values(statusCounts).reduce((s, n) => s + n, 0),
    searchProfileCount,
    lastActiveAt: lastActivity,
  };
}

export async function getPlatformRegistrations() {
  await requireOwner();

  const accounts = await prisma.platformAccount.findMany({
    where: {
      OR: [
        { email: { contains: "jf.taras.cloud" } },
        { email: "jf@taras.cloud" },
      ],
    },
    select: {
      id: true,
      platform: true,
      email: true,
      status: true,
      lastLogin: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { platform: "asc" },
  });

  return { accounts };
}
