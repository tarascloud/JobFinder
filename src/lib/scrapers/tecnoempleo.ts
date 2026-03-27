import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const DELAY_MS = 3000;

/**
 * Tecnoempleo (tecnoempleo.com) — Spanish tech/IT focused job board.
 *
 * Public search at:
 *   https://www.tecnoempleo.com/busqueda-empleo.php?te=KEYWORD&pr=&page=1
 *
 * Job detail pages: /SLUG/rf-ID
 */

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Tecnoempleo formats: "30.000€ - 45.000€", "30.000 - 45.000 €",
  // "Desde 30.000€", "30K - 45K €"
  const euroRange = text.match(
    /([\d.,]+)\s*[kK€]?\s*[-–]\s*([\d.,]+)\s*[kK]?\s*€/
  );
  if (euroRange) {
    let min = parseFloat(euroRange[1].replace(/\./g, "").replace(",", "."));
    let max = parseFloat(euroRange[2].replace(/\./g, "").replace(",", "."));
    // Handle K notation (e.g., 30K = 30000)
    if (min < 1000 && text.toLowerCase().includes("k")) min *= 1000;
    if (max < 1000 && text.toLowerCase().includes("k")) max *= 1000;
    return { min, max, currency: "EUR" };
  }

  const singleEuro = text.match(/([\d.,]+)\s*[kK]?\s*€/);
  if (singleEuro) {
    let val = parseFloat(singleEuro[1].replace(/\./g, "").replace(",", "."));
    if (val < 1000 && text.toLowerCase().includes("k")) val *= 1000;
    return { min: val, max: val, currency: "EUR" };
  }

  return { min: null, max: null, currency: null };
}

interface TecnoempleoJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): TecnoempleoJob[] {
  const jobs: TecnoempleoJob[] = [];
  const seenIds = new Set<string>();

  // Tecnoempleo job links follow pattern: /slug/rf-NNNNNN
  const jobLinkPattern =
    /href="(\/[^"]+\/rf-(\d+)[^"]*)"/gi;
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const [, href, id] = linkMatch;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 2000);
    const regionEnd = Math.min(html.length, pos + 3000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title — usually in the link itself or a nearby heading
    const titleMatch =
      region.match(
        new RegExp(
          `href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
          "i"
        )
      ) ||
      region.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
    if (!title || title.length < 3) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*empresa[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<span[^>]*class="[^"]*offer-company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*ubicacion[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<i[^>]*class="[^"]*fa-map-marker[^"]*"[^>]*><\/i>\s*([\s\S]*?)<\//i);
    const location = locationMatch
      ? stripHtml(locationMatch[1]).trim()
      : "Spain";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salario[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/([\d.,]+\s*€\s*[-–]\s*[\d.,]+\s*€[^<]*)/i);
    const salaryText = salaryMatch
      ? stripHtml(salaryMatch[1]).trim()
      : null;

    // Extract date
    const dateMatch =
      region.match(/datetime="([^"]+)"/i) ||
      region.match(/class="[^"]*fecha[^"]*"[^>]*>([\s\S]*?)<\//i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      const dateStr = dateMatch[1];
      postedAt = new Date(dateStr);
      if (isNaN(postedAt.getTime())) {
        // Try Spanish date format: "dd/mm/yyyy"
        const esDate = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (esDate) {
          postedAt = new Date(
            parseInt(esDate[3]),
            parseInt(esDate[2]) - 1,
            parseInt(esDate[1])
          );
        } else {
          postedAt = null;
        }
      }
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*descripcion[^"]*"[^>]*>([\s\S]*?)<\//i);
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url: `https://www.tecnoempleo.com${href}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

async function searchTecnoempleo(keyword: string): Promise<TecnoempleoJob[]> {
  const params = new URLSearchParams({
    te: keyword,
    pr: "",
    page: "1",
  });

  const url = `https://www.tecnoempleo.com/busqueda-empleo.php?${params.toString()}`;
  console.log(`[tecnoempleo] Fetching: ${keyword}`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.tecnoempleo.com/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(
        `[tecnoempleo] Search for "${keyword}" returned ${res.status}`
      );
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[tecnoempleo] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[tecnoempleo] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: TecnoempleoJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchTecnoempleo(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[tecnoempleo] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[tecnoempleo] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[tecnoempleo] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    const locationLower = (job.location || "").toLowerCase();
    let remoteType: string | null = null;
    if (
      locationLower.includes("remoto") ||
      locationLower.includes("remote") ||
      locationLower.includes("teletrabajo")
    ) {
      remoteType = "remote";
    } else if (
      locationLower.includes("h\u00edbrido") ||
      locationLower.includes("hybrid")
    ) {
      remoteType = "hybrid";
    }

    results.push({
      platform: "tecnoempleo",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType,
      employmentType: null,
      description: job.description,
      language: "es",
      postedAt: job.postedAt,
    });
  }

  console.log(`[tecnoempleo] Returning ${results.length} vacancies`);
  return results;
}
