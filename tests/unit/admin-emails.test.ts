/**
 * Unit tests for POST /api/admin/emails
 *
 * NOTE: the review finding listed a "deploy" route, but jf-private has no
 * /api/deploy route (verified against src/app/api/ and git history).
 * admin/emails is the 4th security-sensitive route from the same finding:
 * token-gated inbound email ingestion (verifyApiToken with
 * JOBFINDER_EMAIL_API_TOKEN / JF_INBOX_TOKEN) + Zod validation + sanitization.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    adminEmail: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sanitize-html", () => ({
  sanitizeHtml: vi.fn((html: string) => html),
}));

import { POST } from "@/app/api/admin/emails/route";
import { prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitize-html";

const EMAIL_TOKEN = "email-api-token-abc";

const mockPrisma = prisma as unknown as {
  adminEmail: { create: ReturnType<typeof vi.fn> };
};

function makeRequest(opts: {
  token?: string;
  hasAuth?: boolean;
  body?: unknown;
} = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.hasAuth !== false) {
    headers["authorization"] = `Bearer ${opts.token ?? EMAIL_TOKEN}`;
  }
  return new NextRequest("http://localhost/api/admin/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(
      opts.body ?? {
        from: "noreply@linkedin.com",
        subject: "Your application was viewed",
        bodyText: "A recruiter viewed your application.",
      }
    ),
  });
}

describe("POST /api/admin/emails — auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_EMAIL_API_TOKEN = EMAIL_TOKEN;
    delete process.env.JF_INBOX_TOKEN;
  });

  it("returns 401 without Authorization header", async () => {
    const res = await POST(makeRequest({ hasAuth: false }));
    expect(res.status).toBe(401);
    expect(mockPrisma.adminEmail.create).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong token", async () => {
    const res = await POST(makeRequest({ token: "wrong" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.adminEmail.create).not.toHaveBeenCalled();
  });

  it("returns 401 when neither token env var is configured", async () => {
    delete process.env.JOBFINDER_EMAIL_API_TOKEN;
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/emails — validation & persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBFINDER_EMAIL_API_TOKEN = EMAIL_TOKEN;
    mockPrisma.adminEmail.create.mockResolvedValue({ id: 1 });
  });

  it("returns 400 for an invalid body (missing subject)", async () => {
    const res = await POST(
      makeRequest({ body: { from: "noreply@linkedin.com" } })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.adminEmail.create).not.toHaveBeenCalled();
  });

  it("stores a valid email and detects platform from sender domain", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.platform).toBe("linkedin");
    expect(mockPrisma.adminEmail.create).toHaveBeenCalledTimes(1);
  });

  it("sanitizes bodyHtml before persisting", async () => {
    const res = await POST(
      makeRequest({
        body: {
          from: "noreply@indeed.com",
          subject: "Interview invitation",
          bodyHtml: "<p>Hello</p><script>alert(1)</script>",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(sanitizeHtml).toHaveBeenCalledWith(
      "<p>Hello</p><script>alert(1)</script>"
    );
  });
});
