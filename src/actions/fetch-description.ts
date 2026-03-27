"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { getRandomUserAgent } from "@/lib/proxy";

/**
 * Fetch full job description from the vacancy URL.
 * Useful for LinkedIn vacancies where the guest API only returns title/company.
 */
export async function fetchVacancyDescription(vacancyId: number): Promise<{ description: string } | { error: string }> {
  try {
    await requireUser();

    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy) return { error: "Vacancy not found" };

    if (vacancy.description && vacancy.description.length > 50) {
      return { description: vacancy.description };
    }

    // Fetch the vacancy page
    const resp = await fetch(vacancy.url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return { error: `Failed to fetch: ${resp.status}` };

    const html = await resp.text();

    // Extract description from common patterns
    let description = "";

    // LinkedIn job page
    const linkedInMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (linkedInMatch) {
      description = linkedInMatch[1];
    }

    // Meta description fallback
    if (!description) {
      const metaMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
      if (metaMatch) description = metaMatch[1];
    }

    // OG description
    if (!description) {
      const ogMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
      if (ogMatch) description = ogMatch[1];
    }

    // JSON-LD JobPosting
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const jsonStr = block.replace(/<\/?script[^>]*>/gi, "");
          const data = JSON.parse(jsonStr);
          if (data["@type"] === "JobPosting" && data.description) {
            description = data.description;
            break;
          }
        } catch { /* skip invalid JSON */ }
      }
    }

    if (!description || description.length < 20) {
      return { error: "Could not extract description from page" };
    }

    // Clean HTML
    description = description
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#?\w+;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Save to DB
    await prisma.vacancy.update({
      where: { id: vacancyId },
      data: { description },
    });

    return { description };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to fetch description" };
  }
}
