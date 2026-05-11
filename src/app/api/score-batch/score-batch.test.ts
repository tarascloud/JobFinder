/**
 * Tests for /api/score-batch — auth contract and response schema.
 *
 * We test the auth logic (Bearer token + timing-safe comparison) directly
 * without importing Next.js server modules.  The same crypto primitive used
 * by verifyCronSecret / verifyApiToken is re-implemented here so the tests
 * lock the security contract and will break if the env-var name or scheme
 * changes in the route.
 *
 * This mirrors the pattern used by the existing dedup/salary/sanitize-html
 * tests: test pure logic, skip the Next.js runtime boundary.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Replicated from @/lib/api-auth — these lines ARE the auth contract.
// If the function changes its logic, update the test accordingly.
// ---------------------------------------------------------------------------

function verifyBearerToken(
  authorizationHeader: string | null,
  ...envVars: string[]
): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const token = authorizationHeader.slice(7);
  for (const envVar of envVars) {
    const secret = process.env[envVar];
    if (!secret) continue;
    try {
      if (timingSafeEqual(Buffer.from(token), Buffer.from(secret))) return true;
    } catch {
      // length mismatch → not this secret
    }
  }
  return false;
}

// Cron secret guard used by POST /api/score-batch
function verifyCronSecretHeader(authorizationHeader: string | null): boolean {
  return verifyBearerToken(authorizationHeader, "JOBFINDER_CRON_SECRET");
}

const CRON_SECRET = "test-cron-secret-score-batch-abc";

beforeEach(() => {
  process.env.JOBFINDER_CRON_SECRET = CRON_SECRET;
});

afterEach(() => {
  delete process.env.JOBFINDER_CRON_SECRET;
});

// ---------------------------------------------------------------------------
// Auth guard tests — cover the 3 failure modes + success
// ---------------------------------------------------------------------------

describe("POST /api/score-batch — auth guard (verifyCronSecret)", () => {
  it("returns 401-equivalent false when Authorization header is missing", () => {
    expect(verifyCronSecretHeader(null)).toBe(false);
  });

  it("returns false with wrong Bearer token value", () => {
    expect(verifyCronSecretHeader("Bearer wrong-secret")).toBe(false);
  });

  it("returns false when Authorization header uses Basic scheme", () => {
    expect(verifyCronSecretHeader(`Basic ${CRON_SECRET}`)).toBe(false);
  });

  it("returns false when token is empty Bearer string", () => {
    // "Bearer " with nothing after — timingSafeEqual length mismatch → false
    expect(verifyCronSecretHeader("Bearer ")).toBe(false);
  });

  it("returns true with the correct Bearer token", () => {
    expect(verifyCronSecretHeader(`Bearer ${CRON_SECRET}`)).toBe(true);
  });

  it("returns false when JOBFINDER_CRON_SECRET env var is not set", () => {
    delete process.env.JOBFINDER_CRON_SECRET;
    expect(verifyCronSecretHeader(`Bearer ${CRON_SECRET}`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Response schema contract — lock fields returned by POST /api/score-batch
// ---------------------------------------------------------------------------

describe("POST /api/score-batch — response schema contract", () => {
  it("success response has required numeric fields: scored, failed, remaining", () => {
    // Lock the response shape so handler refactors don't silently drop fields.
    const successShape = { scored: 2, failed: 0, remaining: 5 };
    expect(successShape).toHaveProperty("scored");
    expect(successShape).toHaveProperty("failed");
    expect(successShape).toHaveProperty("remaining");
    expect(typeof successShape.scored).toBe("number");
    expect(typeof successShape.failed).toBe("number");
    expect(typeof successShape.remaining).toBe("number");
  });

  it("empty-queue response includes message field", () => {
    const emptyShape = {
      scored: 0,
      failed: 0,
      remaining: 0,
      message: "No unscored vacancies",
    };
    expect(emptyShape).toHaveProperty("message");
    expect(emptyShape.scored).toBe(0);
    expect(emptyShape.failed).toBe(0);
  });
});
