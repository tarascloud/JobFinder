import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server before importing the module under test
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {},
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init),
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

import { verifyCronSecret, verifyApiToken } from "../api-auth";

function createMockRequest(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return { headers } as Parameters<typeof verifyCronSecret>[0];
}

describe("verifyApiToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when no authorization header is present", () => {
    const req = createMockRequest();
    expect(verifyApiToken(req, "TEST_SECRET")).toBe(false);
  });

  it("returns false when authorization header is not Bearer", () => {
    const req = createMockRequest("Basic abc123");
    expect(verifyApiToken(req, "TEST_SECRET")).toBe(false);
  });

  it("returns false when env var is not set", () => {
    vi.stubEnv("TEST_SECRET", "");
    const req = createMockRequest("Bearer some-token");
    expect(verifyApiToken(req, "TEST_SECRET")).toBe(false);
  });

  it("returns true when token matches env var", () => {
    vi.stubEnv("MY_SECRET", "valid-token-123");
    const req = createMockRequest("Bearer valid-token-123");
    expect(verifyApiToken(req, "MY_SECRET")).toBe(true);
  });

  it("returns false when token does not match", () => {
    vi.stubEnv("MY_SECRET", "correct-token");
    const req = createMockRequest("Bearer wrong-token!!");
    expect(verifyApiToken(req, "MY_SECRET")).toBe(false);
  });

  it("checks multiple env vars and returns true if any matches", () => {
    vi.stubEnv("SECRET_A", "token-a");
    vi.stubEnv("SECRET_B", "token-b");
    const req = createMockRequest("Bearer token-b");
    expect(verifyApiToken(req, "SECRET_A", "SECRET_B")).toBe(true);
  });
});

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates against JOBFINDER_CRON_SECRET", () => {
    vi.stubEnv("JOBFINDER_CRON_SECRET", "cron-secret-xyz");
    const req = createMockRequest("Bearer cron-secret-xyz");
    expect(verifyCronSecret(req)).toBe(true);
  });

  it("rejects invalid cron secret", () => {
    vi.stubEnv("JOBFINDER_CRON_SECRET", "real-secret");
    const req = createMockRequest("Bearer fake-secret");
    expect(verifyCronSecret(req)).toBe(false);
  });
});
