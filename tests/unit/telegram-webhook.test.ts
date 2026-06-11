/**
 * Unit tests for POST /api/telegram-webhook
 *
 * Security: X-Telegram-Bot-Api-Secret-Token header must match
 * TELEGRAM_WEBHOOK_SECRET env (timing-safe comparison).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    application: { count: vi.fn() },
    userVacancy: { count: vi.fn() },
  },
}));

const mockSendTelegramMessage = vi.fn();
vi.mock("@/lib/telegram-bot", () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
}));

import { POST } from "@/app/api/telegram-webhook/route";
import { prisma } from "@/lib/db";

const WEBHOOK_SECRET = "tg-webhook-secret-123";

const mockPrisma = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

function makeRequest(opts: {
  secret?: string;
  noSecret?: boolean;
  body?: unknown;
} = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (!opts.noSecret) {
    headers["x-telegram-bot-api-secret-token"] = opts.secret ?? WEBHOOK_SECRET;
  }
  return new NextRequest("http://localhost/api/telegram-webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
}

describe("POST /api/telegram-webhook — secret validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("returns 500 when TELEGRAM_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 401 when the secret header is missing", async () => {
    const res = await POST(makeRequest({ noSecret: true }));
    expect(res.status).toBe(401);
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret header is wrong", async () => {
    const res = await POST(makeRequest({ secret: "wrong-secret" }));
    expect(res.status).toBe(401);
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  it("returns 401 for a secret of different length (timing-safe path)", async () => {
    const res = await POST(makeRequest({ secret: WEBHOOK_SECRET + "x" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/telegram-webhook — authorized updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("returns ok for an update without a message", async () => {
    const res = await POST(makeRequest({ body: { update_id: 1 } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("/start links the chat when a user with the Telegram username exists", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: "user@test.local",
    });
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(
      makeRequest({
        body: {
          message: {
            chat: { id: 555 },
            text: "/start",
            from: { username: "test_user" },
          },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: { telegramChatId: "555" },
      })
    );
    expect(mockSendTelegramMessage).toHaveBeenCalled();
  });

  it("/start without a Telegram username asks to set one, no DB write", async () => {
    const res = await POST(
      makeRequest({
        body: {
          message: { chat: { id: 555 }, text: "/start", from: {} },
        },
      })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
  });
});
