import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const API_URL = "https://wellfound.com/api/search";
const SCRAPE_URL = "https://wellfound.com/role/remote";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const rangeMatch = text.match(
    /[\$\€\£]([\d,]+(?:\.\d+)?)\s*[kK]?\s*[-–]\s*[\$\€\£]?([\d,]+(?:\.\d+)?)\s*[kK]?/
  );
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    // Wellfound often shows salary in K format (e.g. $100k - $150k)
    if (text.toLowerCase().includes("k")) {
      if (min < 1000) min *= 1000;
      if (max < 1000) max *= 1000;
    }
    return { min, max, currency: "USD" };
  }

  const singleMatch = text.match(/[\$\€\£]([\d,]+(?:\.\d+)?)\s*[kK]?/);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (text.toLowerCase().includes("k") && val < 1000) val *= 1000;
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface WellfoundJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
}

// Try the JSON API first
async function fetchViaApi(query: string): Promise<WellfoundJob[]> {
  const params = new URLSearchParams({
    query,
    type: "jobs",
    remote: "true",
  });

  const url = `${API_URL}?${params.toString()}`;
  console.log(`[wellfound] Trying API for: ${query}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[wellfound] API returned ${res.status}, falling back to HTML`);
      return [];
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      console.warn(`[wellfound] API returned non-JSON (${contentType}), falling back`);
      return [];
    }

    const data = await res.json();
    const jobs: WellfoundJob[] = [];

    // Wellfound API response shape may vary
    const results = data?.results ?? data?.jobs ?? data?.data ?? [];
    if (!Array.isArray(results)) return [];

    for (const item of results) {
      const id = String(item.id ?? item.slug ?? "");
      if (!id) continue;

      jobs.push({
        externalId: id,
        title: item.title ?? item.name ?? "",
        company: item.company?.name ?? item.startup?.name ?? item.company_name ?? "Unknown",
        location: item.location ?? item.remote ? "Remote" : "Unknown",
        salaryText:
          item.salary ?? item.compensation ??
          (item.salary_min && item.salary_max
            ? `$${item.salary_min.toLocaleString()} - $${item.salary_max.toLocaleString()}`
            : null),
        url:
          item.url ??
          `https://wellfound.com/jobs/${id}`,
        description: item.description ?? item.snippet ?? "",
      });
    }

    return jobs;
  } catch (err) {
    console.warn(
      `[wellfound] API error:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// Fallback: scrape HTML from role page
async function fetchViaHtml(role: string): Promise<WellfoundJob[]> {
  const slug = role.toLowerCase().replace(/\s+/g, "-");
  const url = `${SCRAPE_URL}/${slug}`;
  console.log(`[wellfound] Scraping HTML: ${url}`);

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
      console.warn(`[wellfound] HTML scrape returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const jobs: WellfoundJob[] = [];

    // Try to find embedded JSON data (Next.js __NEXT_DATA__ or Apollo cache)
    const nextDataMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const listings =
          nextData?.props?.pageProps?.listings ??
          nextData?.props?.pageProps?.jobs ??
          [];
        for (const item of listings) {
          const id = String(item.id ?? item.slug ?? "");
          if (!id) continue;
          jobs.push({
            externalId: id,
            title: item.title ?? "",
            company: item.company?.name ?? item.startup?.name ?? "Unknown",
            location: item.location ?? "Remote",
            salaryText: item.compensation ?? null,
            url: item.url ?? `https://wellfound.com/jobs/${id}`,
            description: item.description ?? "",
          });
        }
        if (jobs.length > 0) return jobs;
      } catch {
        // JSON parse failed, continue to HTML parsing
      }
    }

    // HTML fallback: parse job card patterns
    const cardPattern =
      /class="[^"]*styles_component[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(\/jobs\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = cardPattern.exec(html)) !== null) {
      const [, href, content] = match;
      const title = stripHtml(content);
      if (!title) continue;

      const id = href.split("/").pop() ?? href;
      jobs.push({
        externalId: id,
        title,
        company: "Unknown",
        location: "Remote",
        salaryText: null,
        url: `https://wellfound.com${href}`,
        description: "",
      });
    }

    return jobs;
  } catch (err) {
    console.error(
      `[wellfound] HTML scrape error:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[wellfound] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: WellfoundJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      // Try API first, fall back to HTML
      let jobs = await fetchViaApi(title);
      if (jobs.length === 0) {
        await delay(1000);
        jobs = await fetchViaHtml(title);
      }

      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[wellfound] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[wellfound] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[wellfound] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
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
      platform: "wellfound",
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
      postedAt: null,
    });
  }

  console.log(`[wellfound] Returning ${results.length} vacancies`);
  return results;
}
