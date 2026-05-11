/**
 * Unit tests for POST /api/apply
 *
 * Auth: verifyCronSecret (Bearer JOBFINDER_CRON_SECRET)
 * Scope: auth guard only — no actual Playwright browser invocation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    qaPair: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramNotification: vi.fn(),
}));

vi.mock("@/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

// Mock the apply executor so no Playwright browser is launched
vi.mock("@/actions/apply-executor", () => ({
  executeApplyForUser: vi.fn(),
}));

// Mock scheduler helpers
vi.mock("@/lib/apply/scheduler", () => ({
  isWithinApplyWindow: vi.fn().mockReturnValue(true),
  canApplyMore: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/apply/route";
import { prisma } from "@/lib/db";

const CRON_SECRET = "apply-cron-secret-abc";

function makeRequest(opts: {
  token?: string;
  hasAuth?: boolean;
} = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.hasAuth !== false) {
    headers["authorization"] = `Bearer ${opts.token ?? CRON_SECRET}`;
  }
  return new NextRequest("http://localhost/api/apply", {
    method: "POST",
    headers,
  });
}

describe("POST /api/apply — auth guard", () => {
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
    const req = makeRequest({ token: "not-the-secret" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when JOBFINDER_CRON_SECRET env is not set", async () => {
    delete process.env.JOBFINDER_CRON_SECRET;
    const req = makeRequest({ token: CRON_SECRET });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/apply — successful auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
  });

  it("returns 200 with summary schema when no approved applications", async () => {
    const mockPrisma = prisma as unknown as {
      application: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
      user: { findMany: ReturnType<typeof vi.fn> };
      qaPair: { count: ReturnType<typeof vi.fn> };
    };

    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.application.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.qaPair.count.mockResolvedValue(0);

    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    // No applications — should get a message field
    expect(body).toHaveProperty("message");
    expect(body.applied).toBe(0);
    expect(body.failed).toBe(0);
  });

  it("response shape contains all expected counters", async () => {
    const mockPrisma = prisma as unknown as {
      application: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
      user: { findMany: ReturnType<typeof vi.fn> };
      qaPair: { count: ReturnType<typeof vi.fn> };
    };

    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.application.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.qaPair.count.mockResolvedValue(0);

    const req = makeRequest();
    const res = await POST(req);
    const body = await res.json();

    // All counter fields must be present
    expect(typeof body.applied).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(typeof body.skippedWindow).toBe("number");
    expect(typeof body.skippedLimit).toBe("number");
  });
});
