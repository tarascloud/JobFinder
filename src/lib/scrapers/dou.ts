import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const BASE_URL = "https://jobs.dou.ua/vacancies/";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // DOU formats: "$3000-5000", "$3 000 — $5 000", "$3000", "від $3000"
  const usdRange = text.match(
    /\$\s*([\d\s,]+)\s*[-–—]\s*\$?\s*([\d\s,]+)/
  );
  if (usdRange) {
    const min = parseFloat(usdRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(usdRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "USD" };
  }

  const singleUsd = text.match(/\$\s*([\d\s,]+)/);
  if (singleUsd) {
    const val = parseFloat(singleUsd[1].replace(/[\s,]/g, ""));
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface DouJob {
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
 * DOU uses an XHR endpoint to load vacancy listings.
 * The main page at /vacancies/?search=... loads an initial set,
 * and more results come via /vacancies/xhr-load/?search=...&count=N
 *
 * The HTML structure uses .l-vacancy containers with:
 *  - a.vt (vacancy title link, href = vacancy URL)
 *  - .company (company name)
 *  - .cities (location)
 *  - .salary (salary info)
 *  - .sh-info (short description)
 *  - date element with datetime attribute
 */
function parseJobListings(html: string): DouJob[] {
  const jobs: DouJob[] = [];

  // Split by vacancy containers — DOU uses class="l-vacancy" or "vacancy"
  const vacancyPattern =
    /class="[^"]*l-vacancy[^"]*"[\s\S]*?(?=class="[^"]*l-vacancy[^"]*"|<\/div>\s*<div\s+class="more-btn|$)/gi;
  const vacancyBlocks = html.match(vacancyPattern) || [];

  // Fallback: if structured parsing finds nothing, try link-based extraction
  if (vacancyBlocks.length === 0) {
    return parseJobListingsFallback(html);
  }

  for (const block of vacancyBlocks) {
    // Extract vacancy link and title
    const titleLinkMatch = block.match(
      /<a[^>]+class="[^"]*vt[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!titleLinkMatch) continue;

    const url = titleLinkMatch[1];
    const title = stripHtml(titleLinkMatch[2]);
    if (!title) continue;

    // Extract external ID from URL: /vacancies/123456/ or /companies/foo/vacancies/123456/
    const idMatch = url.match(/vacancies\/(\d+)\/?/);
    const externalId = idMatch ? idMatch[1] : url.replace(/[^\w]/g, "");

    // Extract company
    const companyMatch =
      block.match(/<a[^>]+class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch = block.match(
      /class="[^"]*cities[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch ? stripHtml(locationMatch[1]) : null;

    // Extract salary
    const salaryMatch = block.match(
      /class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

    // Extract date
    const dateMatch = block.match(/datetime="([^"]+)"/i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    // Extract description snippet
    const descMatch = block.match(
      /class="[^"]*sh-info[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    jobs.push({
      externalId,
      title,
      company,
      location: location || "Ukraine",
      salaryText: salaryText || null,
      url: url.startsWith("http") ? url : `https://jobs.dou.ua${url}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

/**
 * Fallback parser: find vacancy links by URL pattern
 */
function parseJobListingsFallback(html: string): DouJob[] {
  const jobs: DouJob[] = [];
  const seenIds = new Set<string>();

  // Find all links to DOU vacancy pages
  const linkPattern =
    /href="(https?:\/\/jobs\.dou\.ua\/[^"]*vacancies\/(\d+)\/?[^"]*)"/gi;
  let linkMatch;

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const [, url, id] = linkMatch;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Find surrounding context
    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 1500);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    // Try to extract title from the link text
    const titleMatch = region.match(
      new RegExp(
        `href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
        "i"
      )
    );
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Company
    const companyMatch =
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Location
    const locationMatch = region.match(
      /class="[^"]*cities[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Ukraine";

    // Salary
    const salaryMatch = region.match(
      /class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

    // Date
    const dateMatch = region.match(/datetime="([^"]+)"/i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText,
      url,
      description: "",
      postedAt,
    });
  }

  return jobs;
}

function buildSearchCategory(title: string): string {
  // Map job titles to DOU category slugs
  const mappings: Record<string, string> = {
    frontend: "Front End",
    "front-end": "Front End",
    react: "Front End",
    vue: "Front End",
    angular: "Front End",
    backend: "Back End",
    "back-end": "Back End",
    "full stack": "Full Stack",
    fullstack: "Full Stack",
    devops: "DevOps",
    "data engineer": "Data Engineer",
    "data scientist": "Data Science",
    "machine learning": "Data Science",
    golang: "Golang",
    go: "Golang",
    rust: "Rust",
    java: "Java",
    "c#": ".NET",
    ".net": ".NET",
    python: "Python",
    node: "Node.js",
    nodejs: "Node.js",
    typescript: "Front End",
    ios: "iOS",
    android: "Android",
    flutter: "Flutter",
    "react native": "React Native",
    ruby: "Ruby",
    php: "PHP",
    scala: "Scala",
    kotlin: "Kotlin",
    qa: "QA",
    test: "QA",
    "project manager": "Project Manager",
    "product manager": "Product Manager",
    designer: "Design",
    "ui/ux": "Design",
    security: "Security",
  };

  const lower = title.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  return "";
}

async function searchDou(keyword: string): Promise<DouJob[]> {
  const category = buildSearchCategory(keyword);
  const params = new URLSearchParams();
  params.set("search", keyword);
  if (category) {
    params.set("category", category);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[dou] Fetching: ${keyword}${category ? ` (category: ${category})` : ""}`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://dou.ua/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[dou] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[dou] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[dou] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: DouJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchDou(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[dou] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[dou] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[dou] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    // Determine remote type from location text
    const locationLower = (job.location || "").toLowerCase();
    let remoteType: string | null = null;
    if (locationLower.includes("remote") || locationLower.includes("віддален")) {
      remoteType = "remote";
    } else if (locationLower.includes("hybrid") || locationLower.includes("гібрид")) {
      remoteType = "hybrid";
    }

    results.push({
      platform: "dou",
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
      language: "uk",
      postedAt: job.postedAt,
    });
  }

  console.log(`[dou] Returning ${results.length} vacancies`);
  return results;
}
