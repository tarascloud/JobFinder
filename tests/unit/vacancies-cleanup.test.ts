/**
 * Unit tests for POST /api/vacancies-cleanup
 *
 * Auth: verifyCronSecret (Bearer JOBFINDER_CRON_SECRET).
 * Destructive route — must archive ONLY:
 *   - non-archived vacancies (isArchived: false)
 *   - older than 30 days (scrapedAt < cutoff)
 *   - WITHOUT any applications (applications: { none: {} })
 * and must never hard-delete anything.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    vacancy: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/vacancies-cleanup/route";
import { prisma } from "@/lib/db";

const CRON_SECRET = "cleanup-cron-secret-xyz";

const mockPrisma = prisma as unknown as {
  vacancy: {
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(opts: { token?: string; hasAuth?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.hasAuth !== false) {
    headers["authorization"] = `Bearer ${opts.token ?? CRON_SECRET}`;
  }
  return new NextRequest("http://localhost/api/vacancies-cleanup", {
    method: "POST",
    headers,
  });
}

describe("POST /api/vacancies-cleanup — auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
  });

  it("returns 401 without Authorization header and touches nothing", async () => {
    const res = await POST(makeRequest({ hasAuth: false }));
    expect(res.status).toBe(401);
    expect(mockPrisma.vacancy.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.vacancy.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong Bearer token and touches nothing", async () => {
    const res = await POST(makeRequest({ token: "wrong-secret" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.vacancy.updateMany).not.toHaveBeenCalled();
  });

  it("returns 401 when JOBFINDER_CRON_SECRET env is not set", async () => {
    delete process.env.JOBFINDER_CRON_SECRET;
    const res = await POST(makeRequest({ token: CRON_SECRET }));
    expect(res.status).toBe(401);
    expect(mockPrisma.vacancy.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/vacancies-cleanup — cleanup criteria (archives ONLY what it should)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
    mockPrisma.vacancy.updateMany.mockResolvedValue({ count: 3 });
  });

  it("archives via updateMany with all three protective where-conditions", async () => {
    const before = new Date();
    const res = await POST(makeRequest());
    const after = new Date();
    expect(res.status).toBe(200);

    expect(mockPrisma.vacancy.updateMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.vacancy.updateMany.mock.calls[0][0];

    // 1. Must not touch already-archived vacancies
    expect(args.where.isArchived).toBe(false);

    // 2. Must not touch vacancies the user applied to
    expect(args.where.applications).toEqual({ none: {} });

    // 3. Must only touch vacancies older than ~30 days
    const cutoff: Date = args.where.scrapedAt.lt;
    expect(cutoff).toBeInstanceOf(Date);
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() - 30);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() - 30);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
  });

  it("soft-archives (isArchived + archivedAt), never hard-deletes", async () => {
    await POST(makeRequest());

    const args = mockPrisma.vacancy.updateMany.mock.calls[0][0];
    expect(args.data.isArchived).toBe(true);
    expect(args.data.archivedAt).toBeInstanceOf(Date);

    // Hard delete must never happen
    expect(mockPrisma.vacancy.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.vacancy.delete).not.toHaveBeenCalled();
  });

  it("reports archived count and cutoff date in response", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.archived).toBe(3);
    expect(typeof body.cutoffDate).toBe("string");
    expect(new Date(body.cutoffDate).getTime()).not.toBeNaN();
  });
});
