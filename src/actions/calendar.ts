"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

function formatGCalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (match) => {
    if (match === "\n") return "\\n";
    return `\\${match}`;
  });
}

export async function generateCalendarLink(
  applicationId: number
): Promise<
  | { googleCalendarUrl: string; icsContent: string }
  | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      ...(user.id !== 0 ? { userId: user.id } : {}),
    },
    include: {
      vacancy: {
        select: {
          title: true,
          company: true,
          url: true,
          location: true,
        },
      },
    },
  });

  if (!application) return { error: "Application not found" };
  if (application.status !== "interview") {
    return { error: "Application is not in interview status" };
  }

  const company = application.vacancy.company || "Company";
  const title = `Interview at ${company}`;
  const description = [
    `Position: ${application.vacancy.title}`,
    `Company: ${company}`,
    application.vacancy.location
      ? `Location: ${application.vacancy.location}`
      : null,
    application.vacancy.url
      ? `Job listing: ${application.vacancy.url}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Default: tomorrow at 10:00 local time, 1 hour duration
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setHours(11, 0, 0, 0);

  // Google Calendar URL
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    dates: `${formatGCalDate(tomorrow)}/${formatGCalDate(endTime)}`,
  });
  if (application.vacancy.location) {
    params.set("location", application.vacancy.location);
  }
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

  // ICS content
  const now = new Date();
  const uid = `jf-interview-${applicationId}@jobfinder.app`;
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JobFinder//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(tomorrow)}`,
    `DTEND:${formatICSDate(endTime)}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    application.vacancy.location
      ? `LOCATION:${escapeICS(application.vacancy.location)}`
      : null,
    application.vacancy.url ? `URL:${application.vacancy.url}` : null,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Interview at ${escapeICS(company)} in 30 minutes`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return { googleCalendarUrl, icsContent };
}
