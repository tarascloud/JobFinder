import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function verifyExtensionToken(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_EXTENSION_TOKEN;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
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
    const { url, title, company, description } = body;

    if (!url || !title) {
      return NextResponse.json(
        { error: "Missing required fields: url, title" },
        { status: 400 }
      );
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

    return NextResponse.json({ ok: true, vacancyId: vacancy.id });
  } catch (error) {
    console.error("[extension/save-job] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
