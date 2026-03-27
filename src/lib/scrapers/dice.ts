import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const BASE_URL = "https://www.dice.com/jobs";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Dice formats: "$120,000 - $150,000", "$80/hr - $100/hr", "$120K - $150K"
  const rangeK = text.match(
    /\$\s*([\d,.]+)\s*[kK]\s*[-–—]\s*\$?\s*([\d,.]+)\s*[kK]/
  );
  if (rangeK) {
    const min = parseFloat(rangeK[1].replace(/,/g, "")) * 1000;
    const max = parseFloat(rangeK[2].replace(/,/g, "")) * 1000;
    return { min, max, currency: "USD" };
  }

  const range = text.match(
    /\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/
  );
  if (range) {
    const min = parseFloat(range[1].replace(/,/g, ""));
    const max = parseFloat(range[2].replace(/,/g, ""));
    // If values are small (< 500), likely hourly — convert to annual estimate
    if (min < 500 && max < 500) {
      return { min: min * 2080, max: max * 2080, currency: "USD" };
    }
    return { min, max, currency: "USD" };
  }

  const single = text.match(/\$\s*([\d,]+)/);
  if (single) {
    const val = parseFloat(single[1].replace(/,/g, ""));
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface DiceJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

/**
 * Dice.com job search API endpoint.
 * They have a public search API at /jobs/q-{query}-jobs
 * and also a JSON API at /api/jobs which returns structured data.
 *
 * We try the JSON search API first, fallback to HTML scraping.
 */
async function searchDiceApi(keyword: string): Promise<DiceJob[]> {
  const apiKey = process.env.DICE_API_KEY;
  if (!apiKey) {
    console.warn("[dice] DICE_API_KEY not set, skipping Dice scraper");
    return [];
  }

  // Dice has a public search API
  const params = new URLSearchParams({
    q: keyword,
    countryCode: "US",
    radius: "30",
    radiusUnit: "mi",
    page: "1",
    pageSize: "50",
    filters: "isRemote",
    language: "en",
  });

  const url = `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?${params.toString()}`;
  console.log(`[dice] Fetching API: ${keyword}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!res.ok) {
      console.warn(`[dice] API for "${keyword}" returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const jobs: DiceJob[] = [];

    if (data?.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        const id = item.id || item.detailsPageUrl?.split("/").pop() || "";
        if (!id) continue;

        jobs.push({
          externalId: String(id),
          title: item.title || "",
          company: item.companyName || "Unknown",
          location: item.formattedLocation || item.jobLocation?.displayName || "Remote",
          salaryText: item.salary || item.compensationSummary || null,
          url: item.detailsPageUrl
            ? (item.detailsPageUrl.startsWith("http")
                ? item.detailsPageUrl
                : `https://www.dice.com${item.detailsPageUrl}`)
            : `https://www.dice.com/job-detail/${id}`,
          description: stripHtml(item.summary || item.jobDescription || ""),
          postedAt: item.postedDate ? new Date(item.postedDate) : null,
        });
      }
    }

    return jobs;
  } catch (err) {
    console.warn(
      `[dice] API failed for "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return searchDiceHtml(keyword);
  }
}

/**
 * Fallback: HTML scraping for Dice.com
 */
async function searchDiceHtml(keyword: string): Promise<DiceJob[]> {
  const url = `${BASE_URL}?q=${encodeURIComponent(keyword)}&remote=true`;
  console.log(`[dice] Fetching HTML: ${keyword}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[dice] HTML search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseDiceHtml(html);
  } catch (err) {
    console.error(
      `[dice] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

function parseDiceHtml(html: string): DiceJob[] {
  const jobs: DiceJob[] = [];
  const seenIds = new Set<string>();

  // Dice job links: /job-detail/{uuid}
  const jobLinkPattern =
    /href="(\/job-detail\/([\w-]+))"/gi;
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const [, href, id] = linkMatch;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 500);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    const titleMatch =
      region.match(/class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<a[^>]+href="\/job-detail\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      region.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    const companyMatch =
      region.match(/class="[^"]*card-company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<a[^>]+data-cy="card-company"[^>]*>([\s\S]*?)<\/a>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    const locationMatch =
      region.match(/class="[^"]*card-location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/data-cy="card-location"[^>]*>([\s\S]*?)<\//i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

    const salaryMatch = region.match(
      /class="[^"]*card-salary[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText,
      url: `https://www.dice.com${href}`,
      description: "",
      postedAt: null,
    });
  }

  return jobs;
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[dice] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: DiceJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchDiceApi(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[dice] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[dice] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[dice] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    results.push({
      platform: "dice",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType: "remote",
      employmentType: null,
      description: job.description,
      language: "en",
      postedAt: job.postedAt,
    });
  }

  console.log(`[dice] Returning ${results.length} vacancies`);
  return results;
}
