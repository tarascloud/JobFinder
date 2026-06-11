/**
 * Unit tests for GET /api/resumes/[filename]
 *
 * File-serving route — highest path-traversal risk in the app.
 * Covered:
 *   - auth required (no session / no demo cookie → 401)
 *   - path traversal attempts → 4xx, file system never read
 *   - ownership check (filename must start with "{userId}-") → 403
 *   - non-PDF extension → 400
 *   - happy path serves application/pdf with nosniff
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockStat = vi.fn();
const mockReadFile = vi.fn();

vi.mock("fs/promises", () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/demo-token", () => ({
  DEMO_COOKIE: "demo_token",
  verifyDemoToken: vi.fn().mockResolvedValue(false),
}));

import { GET } from "@/app/api/resumes/[filename]/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeRequest(filename: string): [NextRequest, { params: Promise<{ filename: string }> }] {
  const req = new NextRequest(
    `http://localhost/api/resumes/${encodeURIComponent(filename)}`
  );
  return [req, { params: Promise.resolve({ filename }) }];
}

function loginAs(userId: number) {
  mockAuth.mockResolvedValue({ user: { email: "owner@test.local" } });
  mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
}

describe("GET /api/resumes/[filename] — auth required", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session and no demo cookie", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(...makeRequest("7-123.pdf"));
    expect(res.status).toBe(401);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns 401 when session email has no DB user", async () => {
    mockAuth.mockResolvedValue({ user: { email: "ghost@test.local" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET(...makeRequest("7-123.pdf"));
    expect(res.status).toBe(401);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/resumes/[filename] — path traversal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginAs(7);
  });

  const traversalPayloads = [
    "../../etc/passwd",
    "../../../etc/passwd",
    "..%2F..%2Fetc%2Fpasswd",
    "7-..%2F..%2Fsecret.pdf",
    "7-/etc/passwd",
    "..\\..\\windows\\system32\\config",
  ];

  for (const payload of traversalPayloads) {
    it(`rejects "${payload}" with 4xx and never touches the filesystem`, async () => {
      const res = await GET(...makeRequest(payload));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(mockStat).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  }

  it('rejects bare ".." (passes charset regex but fails ownership) with 403', async () => {
    const res = await GET(...makeRequest(".."));
    expect(res.status).toBe(403);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/resumes/[filename] — ownership and type checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginAs(7);
  });

  it("returns 403 when requesting another user's resume", async () => {
    const res = await GET(...makeRequest("8-1700000000.pdf"));
    expect(res.status).toBe(403);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-PDF extension even if owned", async () => {
    mockStat.mockResolvedValue({ size: 100 });
    const res = await GET(...makeRequest("7-evil.html"));
    expect(res.status).toBe(400);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns 404 when the file does not exist", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));
    const res = await GET(...makeRequest("7-1700000000.pdf"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/resumes/[filename] — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginAs(7);
  });

  it("serves an owned PDF with correct headers", async () => {
    const pdf = Buffer.from("%PDF-1.4 fake pdf body");
    mockStat.mockResolvedValue({ size: pdf.length });
    mockReadFile.mockResolvedValue(pdf);

    const res = await GET(...makeRequest("7-1700000000.pdf"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("refuses to serve a file without PDF magic bytes", async () => {
    const notPdf = Buffer.from("<html>not a pdf</html>");
    mockStat.mockResolvedValue({ size: notPdf.length });
    mockReadFile.mockResolvedValue(notPdf);

    const res = await GET(...makeRequest("7-1700000000.pdf"));
    expect(res.status).toBe(500);
  });
});
