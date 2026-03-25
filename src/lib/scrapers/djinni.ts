import type { ScrapedVacancy, SearchCriteria } from "./types";

const BASE_URL = "https://djinni.co/jobs/";
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
  // Djinni formats: "$3000-$5000", "₴50000-₴80000", "$3 000 - $5 000"
  const usdRange = text.match(
    /\$([\d\s,]+)\s*[-–]\s*\$?([\d\s,]+)/
  );
  if (usdRange) {
    const min = parseFloat(usdRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(usdRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "USD" };
  }

  const uahRange = text.match(
    /₴([\d\s,]+)\s*[-–]\s*₴?([\d\s,]+)/
  );
  if (uahRange) {
    const min = parseFloat(uahRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(uahRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "UAH" };
  }

  const singleUsd = text.match(/\$([\d\s,]+)/);
  if (singleUsd) {
    const val = parseFloat(singleUsd[1].replace(/[\s,]/g, ""));
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

function matchesTitle(title: string, jobTitles: string[]): boolean {
  if (jobTitles.length === 0) return true;
  const lower = title.toLowerCase();
  return jobTitles.some((search) => lower.includes(search.toLowerCase()));
}

interface DjinniJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): DjinniJob[] {
  const jobs: DjinniJob[] = [];

  // Djinni job cards are typically in list-jobs__item or similar containers
  // Each card links to /jobs/{id}/
  const linkPattern =
    /href="(\/jobs\/[\d\w-]+\/?)"[^>]*class="[^"]*profile[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  // Alternative: find job links and extract surrounding card data
  const jobLinkPattern = /href="(\/jobs\/([\d\w-]+)\/?)"[^>]*>/gi;
  const foundIds = new Set<string>();
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const [, href, id] = linkMatch;
    if (foundIds.has(id)) continue;
    foundIds.add(id);

    // Find card region around this link
    const pos = html.indexOf(href);
    const regionStart = Math.max(0, pos - 1500);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title
    const titleMatch =
      region.match(/class="[^"]*job-list-item__link[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      region.match(/class="[^"]*profile[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      region.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*job-list-item__pic[^"]*"[\s\S]*?alt="([^"]*)"/i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/nobr[^>]*>([\s\S]*?)<\/nobr>/i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*public-salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/(\$[\d\s,]+\s*[-–]\s*\$?[\d\s,]+)/i);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]) : null;

    // Extract date
    const dateMatch = region.match(
      /datetime="([^"]+)"/i
    );
    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*job-list-item__description[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i);
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText,
      url: `https://djinni.co${href}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

function mapKeyword(title: string): string {
  // Map common job titles to Djinni primary_keyword values
  const mappings: Record<string, string> = {
    frontend: "JavaScript",
    "front-end": "JavaScript",
    react: "JavaScript",
    backend: "Python",
    "back-end": "Python",
    "full stack": "JavaScript",
    fullstack: "JavaScript",
    devops: "DevOps",
    "data engineer": "Python",
    "data scientist": "Python",
    "machine learning": "Python",
    golang: "Golang",
    go: "Golang",
    rust: "Rust",
    java: "Java",
    "c#": ".NET",
    ".net": ".NET",
    python: "Python",
    node: "Node.js",
    nodejs: "Node.js",
    typescript: "JavaScript",
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
    designer: "Designer",
    "ui/ux": "Designer",
  };

  const lower = title.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  return title;
}

async function searchDjinni(keyword: string): Promise<DjinniJob[]> {
  const mappedKeyword = mapKeyword(keyword);
  const params = new URLSearchParams({
    primary_keyword: mappedKeyword,
    region: "remote",
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[djinni] Fetching: ${keyword} (keyword: ${mappedKeyword})`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[djinni] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[djinni] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[djinni] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: DjinniJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchDjinni(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[djinni] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[djinni] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[djinni] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    results.push({
      platform: "djinni",
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
      language: "uk",
      postedAt: job.postedAt,
    });
  }

  console.log(`[djinni] Returning ${results.length} vacancies`);
  return results;
}
