import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyApiToken } from "@/lib/api-auth";
import { ensureVacancyScore } from "@/lib/save-vacancy";

const SaveJobSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().optional(),
  description: z.string().optional(),
  // TODO: Remove userId from body once extension supports per-user auth tokens.
  // Currently the extension token is global (not per-user), so we cannot derive
  // userId from the bearer token. Validate that userId exists in DB as a safeguard.
  userId: z.number().int().positive(),
  searchProfileId: z.number().int().positive().optional(),
});

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string {
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("glassdoor.com")) return "glassdoor";
  if (url.includes("wellfound.com")) return "wellfound";
  if (url.includes("remoteok.com")) return "remoteok";
  if (url.includes("weworkremotely.com")) return "weworkremotely";
  return "manual";
}

/**
 * Generate a deterministic external ID from URL
 */
function generateExternalId(url: string): string {
  // Use URL path as external ID (strip query params for dedup)
  try {
    const parsed = new URL(url);
    return `ext-${parsed.hostname}${parsed.pathname}`.slice(0, 255);
  } catch {
    return `ext-${Date.now()}`;
  }
}

export async function POST(request: NextRequest) {
  if (!verifyApiToken(request, "JOBFINDER_EXTENSION_TOKEN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = SaveJobSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { url, title, company, description, userId, searchProfileId } = parsed.data;

    // Validate that userId exists in DB (global token cannot guarantee identity)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json(
        { error: "Invalid userId — user not found" },
        { status: 400 }
      );
    }

    // Resolve search profile: use provided or fall back to user's first active profile
    let resolvedProfileId = searchProfileId;
    if (!resolvedProfileId) {
      const profile = await prisma.searchProfile.findFirst({
        where: { userId: Number(userId), isActive: true },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (!profile) {
        return NextResponse.json(
          {
            error:
              "No active search profile found for this user. Create one first or pass searchProfileId.",
          },
          { status: 400 }
        );
      }
      resolvedProfileId = profile.id;
    }

    const platform = detectPlatform(url);
    const externalId = generateExternalId(url);

    // Upsert vacancy — skip if already saved
    const vacancy = await prisma.vacancy.upsert({
      where: {
        platform_externalId: { platform, externalId },
      },
      update: {}, // Don't overwrite if already exists
      create: {
        platform,
        externalId,
        url,
        title,
        company: company || null,
        description: description || "",
        scrapedAt: new Date(),
      },
    });

    // Ensure VacancyScore exists so the vacancy is visible to the user
    await ensureVacancyScore(vacancy.id, Number(userId), resolvedProfileId);

    return NextResponse.json({ ok: true, vacancyId: vacancy.id });
  } catch (error) {
    console.error("[extension/save-job] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
