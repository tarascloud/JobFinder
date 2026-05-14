/**
 * Unit tests for /api/extension/token (GET, POST, DELETE)
 *
 * Auth: requireAuth() — session or demo mode via getCurrentUser().
 * Covers:
 *   - unauthenticated GET → 401
 *   - unauthenticated POST → 401
 *   - unauthenticated DELETE → 401
 *   - authenticated GET → returns current token (or null)
 *   - authenticated POST → generates a new jf_ext_* token and persists it
 *   - authenticated DELETE → clears the token
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { GET, POST, DELETE } from "@/app/api/extension/token/route";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

type MockedPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockedGetCurrentUser = getCurrentUser as unknown as ReturnType<
  typeof vi.fn
>;

describe("GET /api/extension/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns existing token when user has one", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 42 });
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.findUnique.mockResolvedValue({
      extensionToken: "jf_ext_existing_abc",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ token: "jf_ext_existing_abc" });
  });

  it("returns null when user has no token yet", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 42 });
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.findUnique.mockResolvedValue({ extensionToken: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ token: null });
  });
});

describe("POST /api/extension/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("generates a new jf_ext_* token and persists it for the user", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 42 });
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.update.mockResolvedValue({ id: 42 });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toMatch(/^jf_ext_[a-f0-9]{64}$/);

    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 42 });
    expect(updateCall.data.extensionToken).toBe(body.token);
  });

  it("returns a different token each call (regeneration)", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 42 });
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.update.mockResolvedValue({ id: 42 });

    const res1 = await POST();
    const res2 = await POST();
    const t1 = (await res1.json()).token;
    const t2 = (await res2.json()).token;
    expect(t1).not.toBe(t2);
  });
});

describe("DELETE /api/extension/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("clears the extensionToken for the user", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 42 });
    const mockPrisma = prisma as unknown as MockedPrisma;
    mockPrisma.user.update.mockResolvedValue({ id: 42 });

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { extensionToken: null },
    });
  });
});
