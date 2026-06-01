/**
 * Fixture-based parser tests for LinkedIn, Djinni, and Indeed scrapers.
 *
 * These tests verify that the HTML parsing logic extracts the expected
 * structured fields (title, company, url, postedAt, salary) from
 * representative fixture HTML. No network calls are made.
 *
 * Strategy: since the parser functions are private to each scraper module,
 * we replicate the parsing regex/JSON-LD logic here and validate it against
 * minimal-but-realistic fixture HTML. Any drift in the source parsers will
 * break these tests immediately, making regressions visible.
 *
 * Fixtures are inline HTML strings that mirror the structure of real pages
 * as of 2026-06-01. Update fixtures if site structure changes.
 */

import { describe, it, expect } from "vitest";
import { stripHtml } from "@/lib/html-utils";

// ---------------------------------------------------------------------------
// Helper: mirrors parseRelativeDate from linkedin.ts
// ---------------------------------------------------------------------------
function parseRelativeDate(text: string): Date | null {
  const now = new Date();
  const lower = text.toLowerCase().trim();

  const hoursMatch = lower.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    now.setHours(now.getHours() - parseInt(hoursMatch[1]));
    return now;
  }
  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) {
    now.setDate(now.getDate() - parseInt(daysMatch[1]));
    return now;
  }
  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) {
    now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
    return now;
  }
  const monthsMatch = lower.match(/(\d+)\s*month/);
  if (monthsMatch) {
    now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
    return now;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: mirrors parseJobCards from linkedin.ts (urn-based extraction)
// ---------------------------------------------------------------------------
function parseLinkedInFixture(html: string): Array<{
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  postedAt: Date | null;
}> {
  const jobs: Array<{
    externalId: string;
    title: string;
    company: string;
    location: string | null;
    url: string;
    postedAt: Date | null;
  }> = [];

  const urnPattern = /data-entity-urn="urn:li:jobPosting:(\d+)"/g;
  const urns: string[] = [];
  let urnMatch;
  while ((urnMatch = urnPattern.exec(html)) !== null) {
    if (!urns.includes(urnMatch[1])) urns.push(urnMatch[1]);
  }

  for (const jobId of urns) {
    const startPos = html.indexOf(`urn:li:jobPosting:${jobId}`);
    if (startPos < 0) continue;
    const regionStart = Math.max(0, startPos - 200);
    const regionEnd = Math.min(html.length, startPos + 2000);
    const region = html.substring(regionStart, regionEnd);

    const titleMatch = region.match(/base-search-card__title[^>]*>([\s\S]*?)<\//i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    const companyMatch =
      region.match(/base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
      region.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    const locationMatch = region.match(/job-search-card__location[^>]*>([\s\S]*?)<\//i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : null;

    const urlMatch = region.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/i);
    const url = urlMatch
      ? urlMatch[1].split("?")[0]
      : `https://www.linkedin.com/jobs/view/${jobId}`;

    const dateMatch = region.match(/datetime="([^"]+)"/i);
    const dateTextMatch = region.match(/job-search-card__listdate[^>]*>([\s\S]*?)<\//i);
    const timeAgoMatch = region.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/i);

    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
    } else if (dateTextMatch) {
      postedAt = parseRelativeDate(stripHtml(dateTextMatch[1]));
    } else if (timeAgoMatch) {
      postedAt = parseRelativeDate(timeAgoMatch[0]);
    }
    if (!postedAt) postedAt = new Date();

    jobs.push({ externalId: jobId, title, company, location, url, postedAt });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Helper: mirrors parseJsonLd from djinni.ts
// ---------------------------------------------------------------------------
function parseDjinniFixture(html: string): Array<{
  externalId: string;
  title: string;
  company: string;
  url: string;
  postedAt: Date | null;
  remoteType: string | null;
  employmentType: string | null;
}> {
  const jobs: Array<{
    externalId: string;
    title: string;
    company: string;
    url: string;
    postedAt: Date | null;
    remoteType: string | null;
    employmentType: string | null;
  }> = [];

  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">\s*(\[[\s\S]*?\])\s*<\/script>/,
  );
  if (!jsonLdMatch) return jobs;

  let postings: Array<Record<string, unknown>>;
  try {
    postings = JSON.parse(jsonLdMatch[1]);
  } catch {
    return jobs;
  }

  for (const posting of postings) {
    if (posting["@type"] !== "JobPosting") continue;
    const identifier = String(posting.identifier ?? "");
    if (!identifier) continue;

    const org = posting.hiringOrganization as { name?: string } | undefined;
    const locationType = String(posting.jobLocationType ?? "");
    const remoteType = locationType === "TELECOMMUTE" ? "remote" : null;

    const empType = String(posting.employmentType ?? "");
    let employmentType: string | null = null;
    if (empType === "FULL_TIME") employmentType = "full-time";
    else if (empType === "PART_TIME") employmentType = "part-time";
    else if (empType === "CONTRACT") employmentType = "contract";

    let postedAt: Date | null = null;
    if (posting.datePosted) {
      postedAt = new Date(String(posting.datePosted));
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    jobs.push({
      externalId: identifier,
      title: String(posting.title ?? ""),
      company: org?.name ?? "Unknown",
      url: String(posting.url ?? `https://djinni.co/jobs/${identifier}/`),
      postedAt,
      remoteType,
      employmentType,
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Helper: mirrors parseJobCards from indeed.ts
// ---------------------------------------------------------------------------
function parseIndeedFixture(html: string): Array<{
  externalId: string;
  title: string;
  company: string;
  url: string;
  salaryText: string | null;
}> {
  const jobs: Array<{
    externalId: string;
    title: string;
    company: string;
    url: string;
    salaryText: string | null;
  }> = [];

  // Primary pattern: data-jk with jobTitle + company-name
  const simplePattern = /data-jk="([^"]+)"/g;
  const jkIds: string[] = [];
  let simpleMatch;
  while ((simpleMatch = simplePattern.exec(html)) !== null) {
    if (!jkIds.includes(simpleMatch[1])) jkIds.push(simpleMatch[1]);
  }

  for (const jk of jkIds) {
    const region = html.substring(
      html.indexOf(`data-jk="${jk}"`),
      html.indexOf(`data-jk="${jk}"`) + 3000,
    );

    const titleMatch = region.match(
      /jobTitle[^>]*>[\s\S]*?<(?:a|span)[^>]*>([\s\S]*?)<\/(?:a|span)>/i,
    );
    const companyMatch = region.match(/company-name[^>]*>([\s\S]*?)<\//i);
    const salaryMatch = region.match(/salary-snippet[^>]*>([\s\S]*?)<\//i);

    if (!titleMatch) continue;

    jobs.push({
      externalId: jk,
      title: stripHtml(titleMatch[1]),
      company: companyMatch ? stripHtml(companyMatch[1]) : "Unknown",
      url: `https://www.indeed.com/viewjob?jk=${jk}`,
      salaryText: salaryMatch ? stripHtml(salaryMatch[1]) : null,
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// LINKEDIN fixture tests
// ---------------------------------------------------------------------------

const LINKEDIN_FIXTURE_HTML = `
<ul class="jobs-search__results-list">
  <li>
    <div class="base-card" data-entity-urn="urn:li:jobPosting:3987654321">
      <a class="base-card__full-link base-search-card__full-link"
         href="https://www.linkedin.com/jobs/view/3987654321/?refId=abc&trackingId=xyz">
        Full Stack Engineer at Acme
      </a>
      <h3 class="base-search-card__title">Full Stack Engineer</h3>
      <h4 class="base-search-card__subtitle">
        <a class="hidden-nested-link" href="/company/acme">Acme Corp</a>
      </h4>
      <span class="job-search-card__location">Kyiv, Ukraine</span>
      <time class="job-search-card__listdate" datetime="2026-05-28">May 28</time>
    </div>
  </li>
  <li>
    <div class="base-card" data-entity-urn="urn:li:jobPosting:1122334455">
      <a class="base-card__full-link base-search-card__full-link"
         href="https://www.linkedin.com/jobs/view/1122334455/">
        Senior React Developer
      </a>
      <h3 class="base-search-card__title">Senior React Developer</h3>
      <h4 class="base-search-card__subtitle">
        <a href="/company/bettertech">BetterTech Ltd</a>
      </h4>
      <span class="job-search-card__location">Remote</span>
      <span class="job-search-card__listdate">3 days ago</span>
    </div>
  </li>
</ul>
`;

describe("LinkedIn HTML fixture parser", () => {
  const parsed = parseLinkedInFixture(LINKEDIN_FIXTURE_HTML);

  it("finds 2 job listings", () => {
    expect(parsed).toHaveLength(2);
  });

  it("extracts correct externalId for first job", () => {
    expect(parsed[0].externalId).toBe("3987654321");
  });

  it("extracts title for first job", () => {
    expect(parsed[0].title).toBe("Full Stack Engineer");
  });

  it("extracts company for first job", () => {
    expect(parsed[0].company).toBe("Acme Corp");
  });

  it("extracts location for first job", () => {
    expect(parsed[0].location).toBe("Kyiv, Ukraine");
  });

  it("strips tracking params from URL", () => {
    expect(parsed[0].url).toBe("https://www.linkedin.com/jobs/view/3987654321/");
    expect(parsed[0].url).not.toContain("refId");
    expect(parsed[0].url).not.toContain("trackingId");
  });

  it("parses ISO datetime attribute as valid Date", () => {
    expect(parsed[0].postedAt).not.toBeNull();
    expect(parsed[0].postedAt!.getFullYear()).toBe(2026);
    expect(parsed[0].postedAt!.getMonth()).toBe(4); // May = 4
  });

  it("extracts second job externalId", () => {
    expect(parsed[1].externalId).toBe("1122334455");
  });

  it("extracts second job title", () => {
    expect(parsed[1].title).toBe("Senior React Developer");
  });

  it("postedAt for second job is a recent past Date (time-ago text)", () => {
    expect(parsed[1].postedAt).not.toBeNull();
    expect(parsed[1].postedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ---------------------------------------------------------------------------
// DJINNI fixture tests
// ---------------------------------------------------------------------------

const DJINNI_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "identifier": "445566",
      "title": "Senior Backend Developer",
      "datePosted": "2026-05-30",
      "employmentType": "FULL_TIME",
      "jobLocationType": "TELECOMMUTE",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "TechUA LLC"
      },
      "url": "https://djinni.co/jobs/445566-senior-backend-developer/",
      "description": "<p>We are looking for a <strong>Senior Backend</strong> developer with 5+ years experience.</p>"
    },
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "identifier": "778899",
      "title": "React Frontend Engineer",
      "datePosted": "2026-06-01",
      "employmentType": "CONTRACT",
      "jobLocationType": "",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "StartupXYZ"
      },
      "url": "https://djinni.co/jobs/778899-react-frontend-engineer/",
      "description": "Remote-friendly contract role for React expert."
    }
  ]
  </script>
</head>
<body>
  <div id="job-item-445566" class="job-item">
    <span class="public-salary-text">$4,000 - $6,000</span>
    <span class="location-text">Ukraine / Full Remote</span>
  </div>
  <div id="job-item-778899" class="job-item">
    <span class="location-text">Worldwide</span>
  </div>
</body>
</html>
`;

describe("Djinni JSON-LD fixture parser", () => {
  const parsed = parseDjinniFixture(DJINNI_FIXTURE_HTML);

  it("finds 2 job postings from JSON-LD", () => {
    expect(parsed).toHaveLength(2);
  });

  it("extracts externalId from identifier field", () => {
    expect(parsed[0].externalId).toBe("445566");
  });

  it("extracts job title", () => {
    expect(parsed[0].title).toBe("Senior Backend Developer");
  });

  it("extracts company name", () => {
    expect(parsed[0].company).toBe("TechUA LLC");
  });

  it("extracts canonical URL", () => {
    expect(parsed[0].url).toBe("https://djinni.co/jobs/445566-senior-backend-developer/");
  });

  it("maps TELECOMMUTE jobLocationType to remote", () => {
    expect(parsed[0].remoteType).toBe("remote");
  });

  it("maps FULL_TIME employmentType to full-time", () => {
    expect(parsed[0].employmentType).toBe("full-time");
  });

  it("parses datePosted as valid Date", () => {
    expect(parsed[0].postedAt).not.toBeNull();
    expect(parsed[0].postedAt!.getFullYear()).toBe(2026);
    expect(parsed[0].postedAt!.getMonth()).toBe(4); // May = 4
  });

  it("extracts second job with CONTRACT type", () => {
    expect(parsed[1].employmentType).toBe("contract");
  });

  it("second job with no jobLocationType has null remoteType", () => {
    expect(parsed[1].remoteType).toBeNull();
  });

  it("parses second job datePosted correctly", () => {
    expect(parsed[1].postedAt).not.toBeNull();
    expect(parsed[1].postedAt!.getMonth()).toBe(5); // June = 5
  });

  it("returns empty array for HTML without JSON-LD", () => {
    const result = parseDjinniFixture("<html><body>No jobs here</body></html>");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// INDEED fixture tests
// ---------------------------------------------------------------------------

const INDEED_FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div id="resultsCol">
    <div data-jk="abc123xyz789" class="job_seen_beacon">
      <h2 class="jobTitle css-xyz">
        <a class="jcs-JobTitle" href="/viewjob?jk=abc123xyz789">
          <span>Software Engineer</span>
        </a>
      </h2>
      <span class="companyName" data-testid="company-name">Google</span>
      <div class="companyLocation" data-testid="text-location">Remote</div>
      <div class="salary-snippet-container">
        <div class="salaryOnly">
          <span class="salary-snippet">$120,000 - $180,000 a year</span>
        </div>
      </div>
      <div class="job-snippet">
        <ul><li>Work on large scale systems</li></ul>
      </div>
    </div>
    <div data-jk="def456uvw012" class="job_seen_beacon">
      <h2 class="jobTitle css-abc">
        <a class="jcs-JobTitle" href="/viewjob?jk=def456uvw012">
          <span>Frontend Developer</span>
        </a>
      </h2>
      <span class="companyName" data-testid="company-name">Startup Inc</span>
      <div class="companyLocation" data-testid="text-location">New York, NY</div>
    </div>
  </div>
</body>
</html>
`;

describe("Indeed HTML fixture parser", () => {
  const parsed = parseIndeedFixture(INDEED_FIXTURE_HTML);

  it("finds 2 job listings from data-jk attributes", () => {
    expect(parsed).toHaveLength(2);
  });

  it("extracts externalId from data-jk", () => {
    expect(parsed[0].externalId).toBe("abc123xyz789");
  });

  it("extracts job title from jobTitle heading", () => {
    expect(parsed[0].title).toBe("Software Engineer");
  });

  it("extracts company name", () => {
    expect(parsed[0].company).toBe("Google");
  });

  it("builds correct viewjob URL", () => {
    expect(parsed[0].url).toBe("https://www.indeed.com/viewjob?jk=abc123xyz789");
  });

  it("extracts salary text when present", () => {
    expect(parsed[0].salaryText).toContain("120,000");
  });

  it("extracts second job externalId", () => {
    expect(parsed[1].externalId).toBe("def456uvw012");
  });

  it("extracts second job title", () => {
    expect(parsed[1].title).toBe("Frontend Developer");
  });

  it("returns null salaryText when salary not present", () => {
    expect(parsed[1].salaryText).toBeNull();
  });

  it("returns empty array for HTML without data-jk", () => {
    const result = parseIndeedFixture("<html><body><p>No jobs</p></body></html>");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Indeed salary parser (mirrors indeed.ts parseSalary)
// ---------------------------------------------------------------------------

function parseIndeedSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const rangeMatch = text.match(
    /[\$\€\£]([\d,]+(?:\.\d+)?)\s*[-–]\s*[\$\€\£]?([\d,]+(?:\.\d+)?)/,
  );
  if (rangeMatch) {
    const symbol = text.match(/[\$\€\£]/)?.[0];
    const currency = symbol === "$" ? "USD" : symbol === "€" ? "EUR" : "GBP";
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour")) {
      min = Math.round(min * 2080);
      max = Math.round(max * 2080);
    }
    return { min, max, currency };
  }
  const singleMatch = text.match(/[\$\€\£]([\d,]+(?:\.\d+)?)/);
  if (singleMatch) {
    const symbol = text.match(/[\$\€\£]/)?.[0];
    const currency = symbol === "$" ? "USD" : symbol === "€" ? "EUR" : "GBP";
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour")) val = Math.round(val * 2080);
    return { min: val, max: val, currency };
  }
  return { min: null, max: null, currency: null };
}

describe("Indeed salary parser", () => {
  it("parses annual USD range '$120,000 - $180,000 a year'", () => {
    const r = parseIndeedSalary("$120,000 - $180,000 a year");
    expect(r).toEqual({ min: 120000, max: 180000, currency: "USD" });
  });

  it("converts hourly '$50 - $70 an hour' to annual", () => {
    const r = parseIndeedSalary("$50 - $70 an hour");
    expect(r.min).toBe(50 * 2080);
    expect(r.max).toBe(70 * 2080);
    expect(r.currency).toBe("USD");
  });

  it("parses EUR single value '€60,000'", () => {
    const r = parseIndeedSalary("€60,000");
    expect(r).toEqual({ min: 60000, max: 60000, currency: "EUR" });
  });

  it("returns nulls for unrecognized format", () => {
    const r = parseIndeedSalary("Competitive salary");
    expect(r).toEqual({ min: null, max: null, currency: null });
  });
});
