import { prisma } from "@/lib/db";

/**
 * Check if the current time is within the apply window for the given timezone.
 */
export function isWithinApplyWindow(
  hoursStart: number,
  hoursEnd: number,
  timezone: string
): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);

  if (hoursStart <= hoursEnd) {
    // Normal range, e.g. 9-17
    return currentHour >= hoursStart && currentHour < hoursEnd;
  } else {
    // Overnight range, e.g. 22-6
    return currentHour >= hoursStart || currentHour < hoursEnd;
  }
}

/**
 * Count applications with status 'applied' and appliedAt = today for this user + search profile.
 */
export async function getDailyApplyCount(
  userId: number,
  searchProfileId: number
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return prisma.application.count({
    where: {
      userId,
      searchProfileId,
      status: "applied",
      appliedAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });
}

/**
 * Check if the daily apply limit has not been reached yet.
 */
export async function canApplyMore(
  userId: number,
  searchProfileId: number,
  maxDaily: number
): Promise<boolean> {
  const count = await getDailyApplyCount(userId, searchProfileId);
  return count < maxDaily;
}
