/**
 * Unit tests for POST /api/score-batch
 *
 * Auth: verifyCronSecret (Bearer JOBFINDER_CRON_SECRET)
 * Response schema: { scored, failed, remaining } or { scored, failed, remaining, message }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- module mocks (must be hoisted before imports) ---

vi.mock("@/lib/db", () => ({
  prisma: {
    userVacancy: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    vacancyScore: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/scorer", () => ({
  scoreVacancy: vi.fn(),
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramNotification: vi.fn(),
}));

vi.mock("@/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

import { POST } from "@/app/api/score-batch/route";
import { prisma } from "@/lib/db";

const CRON_SECRET = "test-cron-secret-123";

function makeRequest(opts: {
  token?: string;
  hasAuth?: boolean;
} = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.hasAuth !== false) {
    headers["authorization"] = `Bearer ${opts.token ?? CRON_SECRET}`;
  }
  return new NextRequest("http://localhost/api/score-batch", {
    method: "POST",
    headers,
  });
}

describe("POST /api/score-batch — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
  });

  it("returns 401 when no Authorization header", async () => {
    const req = makeRequest({ hasAuth: false });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when Bearer token is wrong", async () => {
    const req = makeRequest({ token: "wrong-token" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when JOBFINDER_CRON_SECRET env is not set", async () => {
    delete process.env.JOBFINDER_CRON_SECRET;
    const req = makeRequest({ token: CRON_SECRET });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/score-batch — response schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
  });

  it("returns {scored,failed,remaining,message} when queue is empty", async () => {
    const mockPrisma = prisma as unknown as {
      userVacancy: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
    };
    mockPrisma.userVacancy.findMany.mockResolvedValue([]);
    mockPrisma.userVacancy.count.mockResolvedValue(0);

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      scored: 0,
      failed: 0,
      remaining: 0,
      message: expect.any(String),
    });
  });

  it("returns {scored,failed,remaining} (no message) after processing vacancies", async () => {
    const { scoreVacancy } = await import("@/lib/ai/scorer");
    const mockPrisma = prisma as unknown as {
      userVacancy: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      vacancyScore: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };

    const fakeUV = {
      id: 1,
      vacancyId: 10,
      userId: 5,
      searchProfileId: null,
      createdAt: new Date(),
      vacancy: {
        title: "Software Engineer",
        company: "Acme",
        location: "Remote",
        description: "Build things",
        salaryText: "$100k",
        remoteType: "remote",
      },
      user: {
        id: 5,
        profile: {
          headline: "Developer",
          summary: "I code",
          yearsExperience: 3,
          skills: ["TypeScript"],
        },
      },
      searchProfile: {
        jobTitles: ["Software Engineer"],
        minSalary: null,
        currency: null,
        remoteOnly: true,
        geographies: [],
      },
    };

    mockPrisma.userVacancy.findMany.mockResolvedValue([fakeUV]);
    mockPrisma.userVacancy.count.mockResolvedValue(0);
    mockPrisma.userVacancy.update.mockResolvedValue({});
    mockPrisma.vacancyScore.findFirst.mockResolvedValue(null);

    vi.mocked(scoreVacancy).mockResolvedValue({
      matchScore: 75,
      salaryFit: true,
      remoteFit: true,
      notes: "Good match",
      detailedAnalysis: null,
    });

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      scored: 1,
      failed: 0,
      remaining: 0,
    });
    // No "message" field in the success path
    expect(body).not.toHaveProperty("message");
  });

  it("increments failed count when user has no profile", async () => {
    const mockPrisma = prisma as unknown as {
      userVacancy: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
    };

    const fakeUVNoProfile = {
      id: 2,
      vacancyId: 11,
      userId: 6,
      searchProfileId: null,
      createdAt: new Date(),
      vacancy: { title: "PM", company: "BigCo", location: null, description: null, salaryText: null, remoteType: null },
      user: { id: 6, profile: null },
      searchProfile: null,
    };

    mockPrisma.userVacancy.findMany.mockResolvedValue([fakeUVNoProfile]);
    mockPrisma.userVacancy.count.mockResolvedValue(0);
    mockPrisma.userVacancy.update.mockResolvedValue({});

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.scored).toBe(0);
  });
});
