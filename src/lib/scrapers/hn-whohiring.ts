import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";

const ALGOLIA_SEARCH_URL =
  "https://hn.algolia.com/api/v1/search_by_date";
const ALGOLIA_ITEM_URL = "https://hn.algolia.com/api/v1/items";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface AlgoliaSearchResult {
  hits: Array<{
    objectID: string;
    title: string;
    created_at: string;
  }>;
}

interface AlgoliaItem {
  id: number;
  title?: string;
  text?: string;
  children?: AlgoliaItem[];
}

interface ParsedComment {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  url: string;
}

// Extract company name from the first line (convention: "Company Name | Role | Location | ...")
function parseFirstLine(line: string): {
  company: string;
  role: string;
  location: string;
  remote: boolean;
  salaryText: string | null;
} {
  const parts = line.split("|").map((p) => p.trim());

  const company = parts[0] || "Unknown";
  const role = parts.length > 1 ? parts[1] : "";
  const locationParts = parts.slice(2);
  const locationStr = locationParts.join(" | ");

  const remote =
    /\bremote\b/i.test(locationStr) ||
    /\bremote\b/i.test(role) ||
    parts.some((p) => /\bremote\b/i.test(p));

  // Try to find salary in any part
  let salaryText: string | null = null;
  for (const part of parts) {
    if (/\$[\d,]+/i.test(part) || /[\d]+k\s*[-–]/i.test(part)) {
      salaryText = part.trim();
      break;
    }
  }

  return {
    company,
    role,
    location: locationStr || (remote ? "Remote" : "Unknown"),
    remote,
    salaryText,
  };
}

function parseSalaryFromText(text: string): {
  min: number | null;
  max: number | null;
} {
  // Patterns: "$120k-$180k", "$120,000 - $180,000", "$150k", "120-180k"
  const kRangeMatch = text.match(
    /\$?([\d,]+)\s*[kK]\s*[-–]\s*\$?([\d,]+)\s*[kK]/
  );
  if (kRangeMatch) {
    return {
      min: parseFloat(kRangeMatch[1].replace(/,/g, "")) * 1000,
      max: parseFloat(kRangeMatch[2].replace(/,/g, "")) * 1000,
    };
  }

  const fullRangeMatch = text.match(
    /\$([\d,]+)\s*[-–]\s*\$?([\d,]+)/
  );
  if (fullRangeMatch) {
    let min = parseFloat(fullRangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(fullRangeMatch[2].replace(/,/g, ""));
    // If values seem like K notation (e.g. 120-180)
    if (min < 1000 && max < 1000) {
      min *= 1000;
      max *= 1000;
    }
    return { min, max };
  }

  const singleKMatch = text.match(/\$?([\d,]+)\s*[kK]/);
  if (singleKMatch) {
    const val = parseFloat(singleKMatch[1].replace(/,/g, "")) * 1000;
    return { min: val, max: val };
  }

  return { min: null, max: null };
}

function parseComment(comment: AlgoliaItem): ParsedComment | null {
  if (!comment.text) return null;

  const text = stripHtml(comment.text);
  if (!text || text.length < 20) return null;

  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const { company, role, location, remote, salaryText } =
    parseFirstLine(firstLine);

  if (!company || company === "Unknown") return null;

  // Also check rest of text for salary if not found in first line
  let finalSalaryText = salaryText;
  if (!finalSalaryText) {
    for (const line of lines.slice(0, 5)) {
      if (/\$[\d,]+/i.test(line) || /[\d]+k\s*[-–]/i.test(line)) {
        finalSalaryText = line.trim();
        break;
      }
    }
  }

  const salary = finalSalaryText
    ? parseSalaryFromText(finalSalaryText)
    : { min: null, max: null };

  const description = lines.slice(1).join("\n").trim();

  return {
    id: String(comment.id),
    company,
    title: role || company,
    location,
    remote,
    salaryText: finalSalaryText,
    salaryMin: salary.min,
    salaryMax: salary.max,
    description,
    url: `https://news.ycombinator.com/item?id=${comment.id}`,
  };
}

function matchesCriteria(
  comment: ParsedComment,
  criteria: SearchCriteria
): boolean {
  // Remote filter
  if (criteria.remoteOnly && !comment.remote) return false;

  // Title filter
  if (criteria.jobTitles.length > 0) {
    const searchText =
      `${comment.title} ${comment.description}`.toLowerCase();
    const matches = criteria.jobTitles.some((t) =>
      searchText.includes(t.toLowerCase())
    );
    if (!matches) return false;
  }

  // Salary filter
  if (
    criteria.minSalary > 0 &&
    comment.salaryMax !== null &&
    criteria.currency.toUpperCase() === "USD" &&
    comment.salaryMax < criteria.minSalary
  ) {
    return false;
  }

  return true;
}

async function findLatestThread(): Promise<string | null> {
  console.log("[hn-whohiring] Searching for latest Who is Hiring thread...");

  const params = new URLSearchParams({
    query: "Ask HN: Who is hiring",
    tags: "story,ask_hn",
    numericFilters: "num_comments>100",
    hitsPerPage: "5",
  });

  try {
    const res = await fetch(`${ALGOLIA_SEARCH_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
      },
    });

    if (!res.ok) {
      console.warn(`[hn-whohiring] Algolia search returned ${res.status}`);
      return null;
    }

    const data: AlgoliaSearchResult = await res.json();

    // Find the most recent "Who is Hiring" thread
    for (const hit of data.hits) {
      if (
        hit.title &&
        /who is hiring/i.test(hit.title) &&
        /\(\w+ \d{4}\)/.test(hit.title)
      ) {
        console.log(
          `[hn-whohiring] Found thread: "${hit.title}" (ID: ${hit.objectID})`
        );
        return hit.objectID;
      }
    }

    console.warn("[hn-whohiring] No matching thread found");
    return null;
  } catch (err) {
    console.error(
      "[hn-whohiring] Error searching for thread:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function fetchThreadComments(
  threadId: string
): Promise<AlgoliaItem[]> {
  console.log(`[hn-whohiring] Fetching comments for thread ${threadId}...`);

  try {
    const res = await fetch(`${ALGOLIA_ITEM_URL}/${threadId}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
      },
    });

    if (!res.ok) {
      console.warn(
        `[hn-whohiring] Item fetch returned ${res.status}`
      );
      return [];
    }

    const data: AlgoliaItem = await res.json();

    // Only get top-level comments (direct children of the thread)
    return data.children ?? [];
  } catch (err) {
    console.error(
      "[hn-whohiring] Error fetching comments:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[hn-whohiring] Starting scrape...");

  const threadId = await findLatestThread();
  if (!threadId) {
    console.warn("[hn-whohiring] Could not find latest thread, returning []");
    return [];
  }

  await delay(1000);

  const comments = await fetchThreadComments(threadId);
  console.log(
    `[hn-whohiring] Fetched ${comments.length} top-level comments, parsing...`
  );

  const results: ScrapedVacancy[] = [];

  for (const comment of comments) {
    const parsed = parseComment(comment);
    if (!parsed) continue;
    if (!matchesCriteria(parsed, criteria)) continue;

    results.push({
      platform: "hn-whohiring",
      externalId: parsed.id,
      url: parsed.url,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      salaryText: parsed.salaryText,
      salaryMin: parsed.salaryMin,
      salaryMax: parsed.salaryMax,
      salaryCurrency:
        parsed.salaryMin || parsed.salaryMax ? "USD" : null,
      remoteType: parsed.remote ? "remote" : null,
      employmentType: null,
      description: parsed.description,
      language: "en",
      postedAt: null,
    });
  }

  console.log(
    `[hn-whohiring] Found ${results.length} matching vacancies out of ${comments.length} comments`
  );
  return results;
}
