/**
 * Unit tests for POST /api/extension/save-job
 *
 * Auth: per-user extensionToken (Bearer token in Authorization header).
 * Covers:
 *   - missing Authorization → 401
 *   - malformed Authorization (no Bearer prefix) → 401
 *   - unknown token → 401
 *   - valid token + valid payload → 200 with vacancyId
 *   - valid token + missing required field → 400
 *   - valid token + foreign searchProfileId → 403
 *   - duplicate URL → upsert returns same vacancyId (dedup)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    searchProfile: {
      findFirst: vi.fn(),
    },
    vacancy: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/save-vacancy", () => ({
  ensureVacancyScore: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/extension/save-job/route";
import { prisma } from "@/lib/db";
import { ensureVacancyScore } from "@/lib/save-vacancy";

type MockedPrisma = {
  user: { findUnique: ReturnType<typeof vi.fn> };
  searchProfile: { findFirst: ReturnType<typeof vi.fn> };
  vacancy: { upsert: ReturnType<typeof vi.fn> };
};

function makeRequest(opts: {
  token?: string;
  authHeader?: string;
  body?: unknown;
}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.authHeader !== undefined) {
    headers["authorization"] = opts.authHeader;
  } else if (opts.token) {
    headers["authorization"] = `Bearer ${opts.token}`;
  }
  return new NextRequest("http://localhost/api/extension/save-job", {
    method: "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("POST /api/extension/save-job — auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest({ body: { url: "https://x.com/j/1", title: "Eng" } });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const req = makeRequest({
      authHeader: "token abc123",
      body: { url: "https://x.com/j/1", title: "Eng" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is unknown (no user with that extensionToken)", async () => {
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = makeRequest({
      token: "jf_ext_unknown",
      body: { url: "https://x.com/j/1", title: "Eng" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { extensionToken: "jf_ext_unknown" },
      select: { id: true },
    });
  });
});

describe("POST /api/extension/save-job — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.findUnique.mockResolvedValue({ id: 42 });
  });

  it("returns 400 when required field 'url' is missing", async () => {
    const req = makeRequest({
      token: "jf_ext_good",
      body: { title: "Engineer" }, // no url
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when required field 'title' is missing", async () => {
    const req = makeRequest({
      token: "jf_ext_good",
      body: { url: "https://x.com/j/1" }, // no title
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when url is not a valid URL", async () => {
    const req = makeRequest({
      token: "jf_ext_good",
      body: { url: "not-a-url", title: "Eng" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    const req = makeRequest({
      token: "jf_ext_good",
      body: { url: "https://x.com/j/1", title: "" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/extension/save-job — happy path & dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.findUnique.mockResolvedValue({ id: 42 });
  });

  it("returns 200 with vacancyId on valid payload (auto-resolved searchProfile)", async () => {
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.searchProfile.findFirst.mockResolvedValue({ id: 7 });
    mockPrisma.vacancy.upsert.mockResolvedValue({ id: 123 });

    const req = makeRequest({
      token: "jf_ext_good",
      body: {
        url: "https://linkedin.com/jobs/view/123",
        title: "Senior Engineer",
        company: "Acme",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, vacancyId: 123 });
    expect(ensureVacancyScore).toHaveBeenCalledWith(123, 42, 7);
  });

  it("returns 400 when user has no active search profile and none provided", async () => {
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.searchProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest({
      token: "jf_ext_good",
      body: { url: "https://x.com/j/1", title: "Eng" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when searchProfileId does not belong to authenticated user", async () => {
    const mockPrisma = prisma as unknown as MockedPrisma;
    // findFirst with {id, userId} filter — returns null when profile id is not owned
    mockPrisma.searchProfile.findFirst.mockResolvedValue(null);

    const req = makeRequest({
      token: "jf_ext_good",
      body: {
        url: "https://x.com/j/1",
        title: "Eng",
        searchProfileId: 999, // foreign
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("dedup: upsert with update={} returns existing vacancy id on duplicate URL", async () => {
    // Simulates two save-job calls with same URL; upsert returns same vacancy id.
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.searchProfile.findFirst.mockResolvedValue({ id: 7 });
    // Both calls return the same existing vacancy id
    mockPrisma.vacancy.upsert.mockResolvedValue({ id: 500 });

    const body = {
      url: "https://linkedin.com/jobs/view/dup",
      title: "Eng",
    };

    const res1 = await POST(makeRequest({ token: "jf_ext_good", body }));
    const res2 = await POST(makeRequest({ token: "jf_ext_good", body }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const b1 = await res1.json();
    const b2 = await res2.json();
    expect(b1.vacancyId).toBe(500);
    expect(b2.vacancyId).toBe(500);

    // upsert called twice with the same where clause — verifies dedup contract
    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledTimes(2);
    const calls = mockPrisma.vacancy.upsert.mock.calls;
    expect(calls[0][0].where).toEqual(calls[1][0].where);
    // update is empty object so we never overwrite existing fields
    expect(calls[0][0].update).toEqual({});
  });
});
