/**
 * Unit tests for POST /api/email-response
 *
 * Auth: verifyApiToken (Bearer JOBFINDER_EMAIL_API_TOKEN or JF_INBOX_TOKEN)
 * HMAC-style: the route uses a static Bearer token (not HMAC); tests cover
 *   - missing token → 401
 *   - wrong token → 401
 *   - valid token → 200 with correct response shape
 *   - bodyHtml XSS payload stripped before persistence
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    emailResponse: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramNotification: vi.fn(),
}));

vi.mock("@/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

// isomorphic-dompurify is not installed in test env — mock sanitizeHtml with
// a minimal implementation that strips <script> and event attrs for testing purposes.
vi.mock("@/lib/sanitize-html", () => ({
  sanitizeHtml: (html: string) => {
    if (!html) return "";
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\s+on\w+="[^"]*"/gi, "")
      .replace(/<img\b[^>]*>/gi, "");
  },
}));

import { POST } from "@/app/api/email-response/route";
import { prisma } from "@/lib/db";

const VALID_TOKEN = "valid-email-api-token";

const VALID_PAYLOAD = {
  from: "recruiter@acme.com",
  to: "user@example.com",
  subject: "Your application to Software Engineer",
  bodyText: "We would like to schedule an interview.",
  responseType: "interview",
};

function makeRequest(opts: {
  token?: string;
  hasAuth?: boolean;
  body?: Record<string, unknown>;
} = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.hasAuth !== false) {
    headers["authorization"] = `Bearer ${opts.token ?? VALID_TOKEN}`;
  }
  return new NextRequest("http://localhost/api/email-response", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? VALID_PAYLOAD),
  });
}

describe("POST /api/email-response — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_EMAIL_API_TOKEN = VALID_TOKEN;
    delete process.env.JF_INBOX_TOKEN;
  });

  it("returns 401 when no Authorization header", async () => {
    const req = makeRequest({ hasAuth: false });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when Bearer token is wrong", async () => {
    const req = makeRequest({ token: "totally-wrong-token" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when neither env var is set", async () => {
    delete process.env.JOBFINDER_EMAIL_API_TOKEN;
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid JF_INBOX_TOKEN as fallback", async () => {
    delete process.env.JOBFINDER_EMAIL_API_TOKEN;
    process.env.JF_INBOX_TOKEN = "inbox-token-456";

    const mockPrisma = prisma as unknown as {
      user: { findUnique: ReturnType<typeof vi.fn> };
      application: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      emailResponse: { create: ReturnType<typeof vi.fn> };
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.application.findFirst.mockResolvedValue(null);
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.emailResponse.create.mockResolvedValue({ id: "er-1" });

    const req = makeRequest({ token: "inbox-token-456" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/email-response — response schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_EMAIL_API_TOKEN = VALID_TOKEN;

    const mockPrisma = prisma as unknown as {
      user: { findUnique: ReturnType<typeof vi.fn> };
      application: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      emailResponse: { create: ReturnType<typeof vi.fn> };
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.application.findFirst.mockResolvedValue(null);
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.emailResponse.create.mockResolvedValue({ id: "er-42" });
  });

  it("returns 200 with {id, matched, applicationId, responseType} on valid payload", async () => {
    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      matched: false,
      applicationId: null,
      responseType: expect.any(String),
    });
  });

  it("returns 400 for invalid payload (missing from/subject)", async () => {
    const req = makeRequest({ body: { responseType: "positive" } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("normalizes unknown responseType to 'info'", async () => {
    const req = makeRequest({
      body: { ...VALID_PAYLOAD, responseType: "unknown-type" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.responseType).toBe("info");
  });
});

describe("POST /api/email-response — bodyHtml sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_EMAIL_API_TOKEN = VALID_TOKEN;
  });

  it("strips XSS from bodyHtml before persisting", async () => {
    let capturedBodyHtml: string | null = null;

    const mockPrisma = prisma as unknown as {
      user: { findUnique: ReturnType<typeof vi.fn> };
      application: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      emailResponse: { create: ReturnType<typeof vi.fn> };
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.application.findFirst.mockResolvedValue(null);
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.emailResponse.create.mockImplementation(async ({ data }: { data: { bodyHtml?: string | null } }) => {
      capturedBodyHtml = data.bodyHtml ?? null;
      return { id: "er-xss" };
    });

    const req = makeRequest({
      body: {
        ...VALID_PAYLOAD,
        bodyHtml: `<p>Hello</p><script>alert('xss')</script><img src=x onerror="evil()">`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(capturedBodyHtml).not.toBeNull();
    expect(capturedBodyHtml).not.toContain("<script>");
    expect(capturedBodyHtml).not.toContain("alert(");
    expect(capturedBodyHtml).not.toContain("onerror");
    expect(capturedBodyHtml).toContain("<p>Hello</p>");
  });

  it("stores null for bodyHtml when not provided", async () => {
    let capturedBodyHtml: string | null | undefined = undefined;

    const mockPrisma = prisma as unknown as {
      user: { findUnique: ReturnType<typeof vi.fn> };
      application: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      emailResponse: { create: ReturnType<typeof vi.fn> };
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.application.findFirst.mockResolvedValue(null);
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.emailResponse.create.mockImplementation(async ({ data }: { data: { bodyHtml?: string | null } }) => {
      capturedBodyHtml = data.bodyHtml;
      return { id: "er-nohtml" };
    });

    const req = makeRequest({
      body: { from: "a@b.com", subject: "hello", responseType: "info" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(capturedBodyHtml).toBeNull();
  });

  it("caps bodyHtml at MAX_BODY_HTML (50 000 chars)", async () => {
    let capturedBodyHtml: string | null | undefined = undefined;

    const mockPrisma = prisma as unknown as {
      user: { findUnique: ReturnType<typeof vi.fn> };
      application: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      emailResponse: { create: ReturnType<typeof vi.fn> };
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.application.findFirst.mockResolvedValue(null);
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.emailResponse.create.mockImplementation(async ({ data }: { data: { bodyHtml?: string | null } }) => {
      capturedBodyHtml = data.bodyHtml;
      return { id: "er-big" };
    });

    const bigHtml = "<p>" + "x".repeat(60_000) + "</p>";
    const req = makeRequest({
      body: { ...VALID_PAYLOAD, bodyHtml: bigHtml },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(capturedBodyHtml).not.toBeNull();
    // After capping + sanitize, result should not exceed original cap + small sanitizer overhead
    expect((capturedBodyHtml ?? "").length).toBeLessThanOrEqual(50_000 + 200);
  });
});
