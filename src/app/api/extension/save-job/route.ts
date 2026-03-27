import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ensureVacancyScore } from "@/lib/save-vacancy";

function verifyExtensionToken(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_EXTENSION_TOKEN;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(auth) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

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
  if (!verifyExtensionToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, title, company, description, userId, searchProfileId } = body;

    if (!url || !title) {
      return NextResponse.json(
        { error: "Missing required fields: url, title" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
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
