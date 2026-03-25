import type { ScrapedVacancy, SearchCriteria } from "./types";

const DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const rangeMatch = text.match(
    /[\$\€\£]([\d,]+(?:\.\d+)?)\s*[-–]\s*[\$\€\£]?([\d,]+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const symbol = text.match(/[\$\€\£]/)?.[0];
    const currency =
      symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : null;
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour") || text.toLowerCase().includes("/hr")) {
      min = Math.round(min * 2080);
      max = Math.round(max * 2080);
    }
    return { min, max, currency };
  }

  return { min: null, max: null, currency: null };
}

function matchesTitle(title: string, jobTitles: string[]): boolean {
  if (jobTitles.length === 0) return true;
  const lower = title.toLowerCase();
  return jobTitles.some((search) => lower.includes(search.toLowerCase()));
}

interface GoogleJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: string | null;
}

function parseGoogleJobsHtml(html: string): GoogleJob[] {
  const jobs: GoogleJob[] = [];

  // Google Jobs embeds structured data in the page as JSON-LD or in special elements
  // Try to find embedded JSON data first
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const listings = Array.isArray(data) ? data : [data];
      for (const item of listings) {
        if (item["@type"] !== "JobPosting") continue;
        const id =
          item.identifier?.value ??
          item.url ??
          String(jobs.length);
        jobs.push({
          externalId: String(id),
          title: item.title ?? "",
          company:
            item.hiringOrganization?.name ??
            item.employer?.name ??
            "Unknown",
          location:
            item.jobLocation?.address?.addressLocality ??
            item.jobLocationType ??
            "Remote",
          salaryText: item.baseSalary
            ? `${item.baseSalary.currency ?? "$"}${
                item.baseSalary.value?.minValue ?? ""
              } - ${item.baseSalary.value?.maxValue ?? ""}`
            : null,
          url: item.url ?? "",
          description: stripHtml(item.description ?? ""),
          postedAt: item.datePosted ?? null,
        });
      }
    } catch {
      // Not valid JSON-LD, skip
    }
  }

  if (jobs.length > 0) return jobs;

  // Fallback: try to parse Google's job listing UI elements
  // Google wraps job cards in specific data attributes
  const jobCardPattern = /data-ved="[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*BjJfJf[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let cardMatch;
  let idx = 0;
  while ((cardMatch = jobCardPattern.exec(html)) !== null) {
    const region = cardMatch[1];
    const title = stripHtml(region.split("<")[0] ?? "");
    if (!title) continue;

    jobs.push({
      externalId: `google-${idx++}`,
      title,
      company: "Unknown",
      location: "Remote",
      salaryText: null,
      url: "",
      description: "",
      postedAt: null,
    });
  }

  return jobs;
}

async function searchGoogleJobs(query: string): Promise<GoogleJob[]> {
  const searchQuery = encodeURIComponent(`${query} remote jobs`);
  const url = `https://www.google.com/search?q=${searchQuery}&ibp=htl;jobs`;

  console.log(`[google-jobs] Fetching: ${query}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Referer: "https://www.google.com/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(
        `[google-jobs] Search for "${query}" returned ${res.status} — Google likely blocked the request`
      );
      return [];
    }

    const html = await res.text();

    // Check if we got a CAPTCHA or block page
    if (
      html.includes("captcha") ||
      html.includes("unusual traffic") ||
      html.includes("automated queries")
    ) {
      console.warn(
        `[google-jobs] Google blocked request (CAPTCHA/rate limit) for "${query}"`
      );
      return [];
    }

    return parseGoogleJobsHtml(html);
  } catch (err) {
    console.error(
      `[google-jobs] Error searching "${query}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[google-jobs] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );
  console.log(
    "[google-jobs] Note: Google heavily blocks automated requests. Results may be empty."
  );

  const allJobs: GoogleJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchGoogleJobs(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[google-jobs] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[google-jobs] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[google-jobs] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!job.title) continue;
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    if (
      criteria.minSalary > 0 &&
      salary.max !== null &&
      criteria.currency.toUpperCase() === (salary.currency ?? "").toUpperCase() &&
      salary.max < criteria.minSalary
    ) {
      continue;
    }

    results.push({
      platform: "google-jobs",
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
      postedAt: job.postedAt ? new Date(job.postedAt) : null,
    });
  }

  console.log(`[google-jobs] Returning ${results.length} vacancies`);
  return results;
}
