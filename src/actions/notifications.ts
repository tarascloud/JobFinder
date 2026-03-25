"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || user.id === 0) return 0;

  return prisma.notification.count({
    where: { userId: user.id, read: false },
  });
}

export async function getNotifications(
  page: number = 1,
  limit: number = 20
): Promise<{
  notifications: {
    id: number;
    type: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: Date;
  }[];
  total: number;
}> {
  const user = await getCurrentUser();
  if (!user || user.id === 0) return { notifications: [], total: 0 };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId: user.id } }),
  ]);

  return { notifications, total };
}

export async function markAsRead(
  id: number
): Promise<{ success: boolean } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || user.id === 0) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  return { success: true };
}

export async function markAllAsRead(): Promise<
  { success: boolean } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user || user.id === 0) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  return { success: true };
}

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<{ id: number } | { error: string }> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link ?? null,
      },
    });
    return { id: notification.id };
  } catch (err) {
    console.error("[notifications] Failed to create:", err);
    return { error: "Failed to create notification" };
  }
}
