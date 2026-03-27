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
 * Uses the user's timezone (from SearchProfile.applyTimezone) to determine "today".
 */
export async function getDailyApplyCount(
  userId: number,
  searchProfileId: number,
  timezone: string = "UTC"
): Promise<number> {
  // Get current date string in the user's timezone (YYYY-MM-DD)
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = dateFormatter.format(now); // e.g. "2026-03-26"

  // Build start/end of day in the user's timezone
  // Parse as local date in that timezone by constructing an ISO-like string
  const todayStart = new Date(
    new Date(`${todayStr}T00:00:00`).toLocaleString("en-US", { timeZone: timezone })
  );
  const todayEnd = new Date(
    new Date(`${todayStr}T23:59:59.999`).toLocaleString("en-US", { timeZone: timezone })
  );

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
  maxDaily: number,
  timezone: string = "UTC"
): Promise<boolean> {
  const count = await getDailyApplyCount(userId, searchProfileId, timezone);
  return count < maxDaily;
}
