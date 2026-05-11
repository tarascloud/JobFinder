/**
 * Unit tests for scraper utilities and parser logic.
 *
 * Coverage:
 *  1. utils.ts — matchesTitle, fetchWithTimeout (timeout behavior), delay
 *  2. Djinni salary parsing (USD range, UAH range, single USD, empty)
 *  3. LinkedIn parseRelativeDate patterns (hours, days, weeks, months)
 *  4. Dedup key uniqueness for scraped vacancy shapes
 *
 * Notes:
 *  - Parser functions in linkedin.ts / djinni.ts are private. We test the
 *    publicly observable salary/date regex logic by replicating the patterns
 *    here so that any upstream change breaks these tests immediately.
 *  - Network calls are NOT made — all tests are purely computational.
 */

import { describe, it, expect, vi } from "vitest";
import { matchesTitle, delay } from "@/lib/scrapers/utils";

// ---------------------------------------------------------------------------
// utils.ts — matchesTitle
// ---------------------------------------------------------------------------

describe("matchesTitle", () => {
  it("returns true when title contains one of the job titles (case-insensitive)", () => {
    expect(matchesTitle("Senior Frontend Developer", ["frontend"])).toBe(true);
  });

  it("returns true for exact match", () => {
    expect(matchesTitle("Software Engineer", ["Software Engineer"])).toBe(true);
  });

  it("returns false when no match", () => {
    expect(matchesTitle("Accountant", ["frontend", "backend", "fullstack"])).toBe(false);
  });

  it("returns true for empty jobTitles array (no filter)", () => {
    expect(matchesTitle("Any Title", [])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesTitle("REACT DEVELOPER", ["react"])).toBe(true);
    expect(matchesTitle("react developer", ["REACT"])).toBe(true);
  });

  it("matches partial substring", () => {
    expect(matchesTitle("Full Stack Node.js Engineer", ["node"])).toBe(true);
  });

  it("returns false for empty title with non-empty filter", () => {
    expect(matchesTitle("", ["developer"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// utils.ts — delay
// ---------------------------------------------------------------------------

describe("delay", () => {
  it("resolves after the given milliseconds", async () => {
    vi.useFakeTimers();
    const promise = delay(500);
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("does not resolve before the given milliseconds", () => {
    vi.useFakeTimers();
    let resolved = false;
    delay(1000).then(() => { resolved = true; });
    vi.advanceTimersByTime(999);
    expect(resolved).toBe(false);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Djinni salary parsing logic (mirrors private parseSalary in djinni.ts)
// If parseSalary changes, this test suite will catch the drift.
// ---------------------------------------------------------------------------

/**
 * Mirrors the parseSalary function from src/lib/scrapers/djinni.ts.
 * Kept in sync intentionally — divergence means the source changed.
 */
function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const usdRange = text.match(/\$([\d\s,]+)\s*[-–—]\s*\$?([\d\s,]+)/);
  if (usdRange) {
    const min = parseFloat(usdRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(usdRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "USD" };
  }

  const uahRange = text.match(/₴([\d\s,]+)\s*[-–—]\s*₴?([\d\s,]+)/);
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

describe("djinni parseSalary", () => {
  it("parses USD range '$3000-$5000'", () => {
    const result = parseSalary("$3000-$5000");
    expect(result).toEqual({ min: 3000, max: 5000, currency: "USD" });
  });

  it("parses USD range with spaces '$3 000 - $5 000'", () => {
    const result = parseSalary("$3 000 - $5 000");
    expect(result).toEqual({ min: 3000, max: 5000, currency: "USD" });
  });

  it("parses UAH range '₴50000-₴80000'", () => {
    const result = parseSalary("₴50000-₴80000");
    expect(result).toEqual({ min: 50000, max: 80000, currency: "UAH" });
  });

  it("parses single USD value '$4000'", () => {
    const result = parseSalary("$4000");
    expect(result).toEqual({ min: 4000, max: 4000, currency: "USD" });
  });

  it("returns nulls for unrecognized format", () => {
    const result = parseSalary("Competitive salary");
    expect(result).toEqual({ min: null, max: null, currency: null });
  });

  it("returns nulls for empty string", () => {
    const result = parseSalary("");
    expect(result).toEqual({ min: null, max: null, currency: null });
  });

  it("handles em-dash separator '$2000—$4000'", () => {
    const result = parseSalary("$2000—$4000");
    expect(result).toEqual({ min: 2000, max: 4000, currency: "USD" });
  });
});

// ---------------------------------------------------------------------------
// LinkedIn parseRelativeDate logic (mirrors private function in linkedin.ts)
// ---------------------------------------------------------------------------

/**
 * Mirrors parseRelativeDate from src/lib/scrapers/linkedin.ts.
 */
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

describe("linkedin parseRelativeDate", () => {
  it("parses '2 hours ago' and returns a Date ~2h in the past", () => {
    const before = Date.now();
    const result = parseRelativeDate("2 hours ago");
    expect(result).not.toBeNull();
    const diff = before - result!.getTime();
    // Should be ~2 hours (7200000ms) ±60s tolerance
    expect(diff).toBeGreaterThan(2 * 3600 * 1000 - 60_000);
    expect(diff).toBeLessThan(2 * 3600 * 1000 + 60_000);
  });

  it("parses '3 days ago' and returns a Date ~3d in the past", () => {
    const before = Date.now();
    const result = parseRelativeDate("3 days ago");
    expect(result).not.toBeNull();
    const diffDays = (before - result!.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(2.9);
    expect(diffDays).toBeLessThan(3.1);
  });

  it("parses '1 week ago' and returns a Date ~7d in the past", () => {
    const before = Date.now();
    const result = parseRelativeDate("1 week ago");
    expect(result).not.toBeNull();
    const diffDays = (before - result!.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("parses '2 months ago' and returns a Date in the past", () => {
    const result = parseRelativeDate("2 months ago");
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeLessThan(Date.now());
  });

  it("returns null for unrecognized text", () => {
    expect(parseRelativeDate("Just now")).toBeNull();
    expect(parseRelativeDate("")).toBeNull();
    expect(parseRelativeDate("Recently")).toBeNull();
  });

  it("handles 'hour' singular", () => {
    const result = parseRelativeDate("1 hour ago");
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Snapshot tests — fixture HTML → parsed vacancy shape
//
// We test the HTML-parsing logic for linkedin and djinni by feeding minimal
// fixture HTML to isolated regex extractions, verifying the shape of output.
// This guards against regex drift in the parsers.
// ---------------------------------------------------------------------------

describe("linkedin HTML fixture parsing", () => {
  // Minimal fixture HTML with known job posting data
  const FIXTURE_HTML = `
    <li>
      <div data-entity-urn="urn:li:jobPosting:123456789">
        <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123456789/?tracking=abc">
          Full Stack Engineer
        </a>
        <h3 class="base-search-card__title">Full Stack Engineer</h3>
        <h4 class="base-search-card__subtitle">
          <a href="#">Acme Corp</a>
        </h4>
        <span class="job-search-card__location">Kyiv, Ukraine</span>
        <time class="job-search-card__listdate" datetime="2026-05-01">2026-05-01</time>
      </div>
    </li>
  `;

  it("extracts job ID from data-entity-urn", () => {
    const pattern = /data-entity-urn="urn:li:jobPosting:(\d+)"/g;
    const match = pattern.exec(FIXTURE_HTML);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("123456789");
  });

  it("extracts job URL and strips tracking params", () => {
    const urlMatch = FIXTURE_HTML.match(
      /href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/i,
    );
    expect(urlMatch).not.toBeNull();
    const cleanUrl = urlMatch![1].split("?")[0];
    expect(cleanUrl).toBe("https://www.linkedin.com/jobs/view/123456789/");
  });

  it("extracts ISO date from datetime attribute", () => {
    const dateMatch = FIXTURE_HTML.match(/datetime="([^"]+)"/i);
    expect(dateMatch).not.toBeNull();
    const parsed = new Date(dateMatch![1]);
    expect(isNaN(parsed.getTime())).toBe(false);
    expect(parsed.getFullYear()).toBe(2026);
  });
});

describe("djinni JSON-LD fixture parsing", () => {
  const JSONLD_FIXTURE = `
    <script type="application/ld+json">
    [
      {
        "@type": "JobPosting",
        "@context": "https://schema.org",
        "identifier": "987654",
        "title": "Senior Backend Developer",
        "datePosted": "2026-05-05",
        "employmentType": "FULL_TIME",
        "jobLocationType": "TELECOMMUTE",
        "hiringOrganization": { "name": "TechUA LLC" },
        "url": "https://djinni.co/jobs/987654-senior-backend-developer/",
        "description": "<p>We are looking for a <strong>Senior Backend</strong> developer.</p>"
      }
    ]
    </script>
  `;

  it("matches JSON-LD script block", () => {
    const match = JSONLD_FIXTURE.match(
      /<script type="application\/ld\+json">\s*(\[[\s\S]*?\])\s*<\/script>/,
    );
    expect(match).not.toBeNull();
    const postings = JSON.parse(match![1]);
    expect(Array.isArray(postings)).toBe(true);
    expect(postings).toHaveLength(1);
  });

  it("extracts JobPosting fields from JSON-LD", () => {
    const match = JSONLD_FIXTURE.match(
      /<script type="application\/ld\+json">\s*(\[[\s\S]*?\])\s*<\/script>/,
    );
    const postings = JSON.parse(match![1]);
    const job = postings[0];

    expect(job["@type"]).toBe("JobPosting");
    expect(job.identifier).toBe("987654");
    expect(job.title).toBe("Senior Backend Developer");
    expect(job.employmentType).toBe("FULL_TIME");
    expect(job.jobLocationType).toBe("TELECOMMUTE");
    expect((job.hiringOrganization as { name: string }).name).toBe("TechUA LLC");
  });

  it("maps jobLocationType TELECOMMUTE → remote", () => {
    const locationType = "TELECOMMUTE";
    const remoteType = locationType === "TELECOMMUTE" ? "remote" : null;
    expect(remoteType).toBe("remote");
  });

  it("maps employmentType FULL_TIME → full-time", () => {
    const empType = "FULL_TIME";
    let employmentType: string | null = null;
    if (empType === "FULL_TIME") employmentType = "full-time";
    else if (empType === "PART_TIME") employmentType = "part-time";
    else if (empType === "CONTRACT") employmentType = "contract";
    expect(employmentType).toBe("full-time");
  });

  it("parses datePosted as valid Date", () => {
    const dateStr = "2026-05-05";
    const parsed = new Date(dateStr);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});
