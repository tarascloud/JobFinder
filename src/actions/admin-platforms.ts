"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { encrypt, decryptGraceful } from "@/lib/encryption";
import { scrapePlatform } from "@/lib/scrapers";
import type { SearchCriteria } from "@/lib/scrapers/types";
import { ALL_PLATFORMS, type PlatformMeta, type PlatformStatus } from "@/lib/platforms";

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner")
    throw new Error("Forbidden: owner access required");
  return user;
}

// ---------------------------------------------------------------------------
// Platform metadata — static info about each scraper
// ---------------------------------------------------------------------------

const PLATFORM_METADATA: Record<string, PlatformMeta> = {
  linkedin: {
    requiresAuth: false,
    reliability: "reliable",
    registrationUrl: "https://www.linkedin.com/signup",
    note: "Guest job search API. May rate-limit.",
  },
  indeed: {
    requiresAuth: false,
    reliability: "unreliable",
    note: "Aggressive bot detection, often returns 0 results.",
  },
  remoteok: {
    requiresAuth: false,
    reliability: "reliable",
    note: "Public JSON API, no registration needed.",
  },
  weworkremotely: {
    requiresAuth: false,
    reliability: "reliable",
    note: "Public RSS feeds, no auth needed.",
  },
  glassdoor: {
    requiresAuth: false,
    reliability: "unreliable",
    registrationUrl: "https://www.glassdoor.com/member/join.htm",
    note: "Heavy JS rendering, often finds 0 jobs.",
  },
  wellfound: {
    requiresAuth: false,
    reliability: "unreliable",
    registrationUrl: "https://wellfound.com/login",
    note: "API returns non-JSON, HTML scraping is fragile.",
  },
  "hn-whohiring": {
    requiresAuth: false,
    reliability: "reliable",
    note: "Algolia HN API, fully public.",
  },
  djinni: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://djinni.co/signup",
    note: "UA tech board. Works sometimes, depends on IP/region.",
  },
  dou: {
    requiresAuth: false,
    reliability: "moderate",
    note: "Public HTML scraping. Major UA board.",
  },
  workua: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://www.work.ua/jobseeker/registration/",
    note: "Largest UA platform. HTML scraping.",
  },
  robotaua: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://robota.ua/registration",
    note: "Second largest UA platform. HTML scraping.",
  },
  dice: {
    requiresAuth: false,
    reliability: "reliable",
    registrationUrl: "https://www.dice.com/register",
    note: "DHI Group search API. Works well for US tech.",
  },
  simplyhired: {
    requiresAuth: false,
    reliability: "moderate",
    note: "Job aggregator, HTML scraping. May have bot detection.",
  },
  arcdev: {
    requiresAuth: false,
    reliability: "reliable",
    note: "RSS feed + HTML fallback. Works well.",
  },
  himalayas: {
    requiresAuth: false,
    reliability: "reliable",
    note: "Public JSON API, no auth needed.",
  },
  infojobs: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://www.infojobs.net/registro",
    note: "#1 Spanish job board. HTML scraping, may detect bots.",
  },
  tecnoempleo: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://www.tecnoempleo.com/registro",
    note: "Spanish tech/IT board. HTML scraping, usually works.",
  },
  jobatus: {
    requiresAuth: false,
    reliability: "moderate",
    note: "Spanish job aggregator. HTML scraping, usually works.",
  },
  computrabajo: {
    requiresAuth: false,
    reliability: "moderate",
    registrationUrl: "https://www.computrabajo.com/registro",
    note: "Spanish/LATAM job board. May have bot detection.",
  },
  ziprecruiter: {
    requiresAuth: false,
    reliability: "unreliable",
    registrationUrl: "https://www.ziprecruiter.com/register",
    note: "Bot detection, often returns empty pages.",
  },
  nodesk: {
    requiresAuth: false,
    reliability: "moderate",
    note: "Remote jobs aggregator. HTML scraping, public listings.",
  },
  relocateme: {
    requiresAuth: false,
    reliability: "moderate",
    note: "Relocation-focused tech jobs. Small catalog (~45 jobs), easy HTML.",
  },
  "4dayweek": {
    requiresAuth: false,
    reliability: "moderate",
    note: "4-day week remote jobs. Preloaded JSON data, public listings.",
  },
  euroremotejobs: {
    requiresAuth: false,
    reliability: "moderate",
    note: "EU remote jobs. WordPress-based, HTML scraping.",
  },
};

/**
 * Return platform metadata for use in the UI.
 */
export async function getPlatformMetadata(): Promise<
  Record<string, PlatformMeta>
> {
  await requireOwner();
  return PLATFORM_METADATA;
}

// ---------------------------------------------------------------------------
// Service credentials (shared email + password for registrations)
// ---------------------------------------------------------------------------

export async function getEnabledPlatforms(): Promise<Record<string, boolean>> {
  await requireOwner();
  const rows = await prisma.$queryRawUnsafe<{ platform: string; enabled: boolean }[]>(
    `SELECT platform, enabled FROM platform_settings`
  );
  const map: Record<string, boolean> = {};
  for (const p of ALL_PLATFORMS) map[p] = true; // default enabled
  for (const r of rows) map[r.platform] = r.enabled;
  return map;
}

export async function togglePlatform(platform: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requireOwner();
  await prisma.$executeRawUnsafe(
    `INSERT INTO platform_settings (platform, enabled, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (platform) DO UPDATE SET enabled = $2, updated_at = NOW()`,
    platform, enabled
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Service credentials
// ---------------------------------------------------------------------------

export async function getServiceCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const owner = await requireOwner();

  const record = await prisma.platformAccount.findFirst({
    where: {
      userId: owner.id,
      platform: "__service_credentials__",
    },
  });

  if (!record) return null;

  return {
    email: record.email ?? "",
    password: record.passwordEncrypted
      ? (decryptGraceful(record.passwordEncrypted) ?? "")
      : "",
  };
}

export async function saveServiceCredentials(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const owner = await requireOwner();

  if (!email?.trim()) {
    return { ok: false, error: "Email is required" };
  }

  const existing = await prisma.platformAccount.findFirst({
    where: {
      userId: owner.id,
      platform: "__service_credentials__",
    },
  });

  if (existing) {
    await prisma.platformAccount.update({
      where: { id: existing.id },
      data: {
        email: email.trim(),
        passwordEncrypted: password ? encrypt(password) : null,
      },
    });
  } else {
    await prisma.platformAccount.create({
      data: {
        userId: owner.id,
        platform: "__service_credentials__",
        authType: "password",
        email: email.trim(),
        passwordEncrypted: password ? encrypt(password) : null,
        status: "active",
      },
    });
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Real integration check — does a test scrape with a generic keyword
// ---------------------------------------------------------------------------

const TEST_CRITERIA: SearchCriteria = {
  jobTitles: ["software engineer"],
  geographies: [],
  remoteOnly: false,
  minSalary: 0,
  currency: "USD",
};

// PlatformStatus type is in @/lib/platforms

/**
 * Check a single platform's integration by running a real test scrape.
 * Returns vacancy count on success, or error details on failure.
 */
export async function checkPlatformIntegration(
  platform: string,
): Promise<PlatformStatus> {
  await requireOwner();

  if (
    !ALL_PLATFORMS.includes(platform as (typeof ALL_PLATFORMS)[number])
  ) {
    return {
      platform,
      status: "error",
      lastCheck: new Date().toISOString(),
      message: `Unknown platform: ${platform}`,
      vacancyCount: 0,
    };
  }

  try {
    // 15s timeout via Promise.race
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Test scrape timed out (15s)")),
        15_000,
      ),
    );

    const scrapePromise = scrapePlatform(platform, TEST_CRITERIA);
    const results = await Promise.race([scrapePromise, timeout]);

    const count = results.length;
    if (count > 0) {
      return {
        platform,
        status: "connected",
        lastCheck: new Date().toISOString(),
        message: `${count} vacancies found`,
        vacancyCount: count,
      };
    } else {
      return {
        platform,
        status: "blocked",
        lastCheck: new Date().toISOString(),
        message: "0 vacancies returned — may be blocked or empty",
        vacancyCount: 0,
      };
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return {
      platform,
      status: "unreachable",
      lastCheck: new Date().toISOString(),
      message,
      vacancyCount: 0,
    };
  }
}

/**
 * Check all platforms and return their statuses.
 * Runs scrapers in parallel (they already have their own delays).
 */
export async function getAllPlatformStatuses(): Promise<
  PlatformStatus[]
> {
  await requireOwner();

  const results = await Promise.allSettled(
    ALL_PLATFORMS.map(async (platform) => {
      return checkPlatformIntegration(platform);
    }),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      platform: ALL_PLATFORMS[i],
      status: "error",
      lastCheck: new Date().toISOString(),
      message: r.reason?.message ?? "Check failed",
      vacancyCount: 0,
    };
  });
}
