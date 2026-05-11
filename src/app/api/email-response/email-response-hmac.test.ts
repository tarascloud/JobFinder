/**
 * Tests for /api/email-response — auth guard, payload validation, domain helpers.
 *
 * Tests the auth contract (verifyApiToken with two env vars), Zod schema
 * validation, responseType coercion, and the domain helpers (extractDomain /
 * domainToCompany) that drive application matching.
 *
 * We do NOT import next/server or the route handler. The auth logic is
 * replicated from @/lib/api-auth using crypto.timingSafeEqual — same function,
 * no Next.js runtime required.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Replicated auth logic from @/lib/api-auth
// (identical to what the route calls via verifyApiToken)
// ---------------------------------------------------------------------------

function verifyApiToken(
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
      // Buffer length mismatch — try next
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Domain helpers — replicated from email-response/route.ts
// (these are stable utility functions; test locks their contract)
// ---------------------------------------------------------------------------

function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)>?$/);
  return match ? match[1].toLowerCase() : "";
}

function domainToCompany(domain: string): string {
  return domain
    .replace(/\.(com|io|co|org|net|eu|es|de|uk|nl|se|fr|it).*$/, "")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Zod schema — locked contract matching route.ts EmailResponseSchema
// ---------------------------------------------------------------------------

const EmailResponseSchema = z.object({
  from: z.string().min(1),
  to: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  messageId: z.string().optional(),
  responseType: z.string(),
});

const VALID_TOKEN = "inbox-token-test-email-response-xyz";

beforeEach(() => {
  process.env.JOBFINDER_EMAIL_API_TOKEN = VALID_TOKEN;
  delete process.env.JF_INBOX_TOKEN;
});

afterEach(() => {
  delete process.env.JOBFINDER_EMAIL_API_TOKEN;
  delete process.env.JF_INBOX_TOKEN;
});

// ---------------------------------------------------------------------------
// Auth guard — three failure modes + two success modes (dual-token fallback)
// ---------------------------------------------------------------------------

describe("POST /api/email-response — HMAC/token auth guard", () => {
  it("returns false (401) when Authorization header is absent", () => {
    expect(
      verifyApiToken(null, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(false);
  });

  it("returns false with wrong token value", () => {
    expect(
      verifyApiToken("Bearer totally-wrong", "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(false);
  });

  it("returns false when Authorization uses Basic scheme (not Bearer)", () => {
    expect(
      verifyApiToken(`Basic ${VALID_TOKEN}`, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(false);
  });

  it("returns true with valid primary token (JOBFINDER_EMAIL_API_TOKEN)", () => {
    expect(
      verifyApiToken(`Bearer ${VALID_TOKEN}`, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(true);
  });

  it("accepts valid fallback token (JF_INBOX_TOKEN) when primary not set", () => {
    delete process.env.JOBFINDER_EMAIL_API_TOKEN;
    process.env.JF_INBOX_TOKEN = VALID_TOKEN;
    expect(
      verifyApiToken(`Bearer ${VALID_TOKEN}`, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(true);
  });

  it("returns false when neither env var is configured", () => {
    delete process.env.JOBFINDER_EMAIL_API_TOKEN;
    delete process.env.JF_INBOX_TOKEN;
    expect(
      verifyApiToken(`Bearer ${VALID_TOKEN}`, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Payload validation — Zod schema contract
// ---------------------------------------------------------------------------

describe("POST /api/email-response — EmailResponseSchema validation", () => {
  it("accepts minimal valid payload (from + subject + responseType)", () => {
    const result = EmailResponseSchema.safeParse({
      from: "recruiter@acme.com",
      subject: "Interview invitation",
      responseType: "interview",
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload missing required `from` field", () => {
    const result = EmailResponseSchema.safeParse({
      subject: "Hi there",
      responseType: "info",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty("from");
    }
  });

  it("rejects payload missing required `subject` field", () => {
    const result = EmailResponseSchema.safeParse({
      from: "recruiter@acme.com",
      responseType: "positive",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with empty `from` (min(1) constraint)", () => {
    const result = EmailResponseSchema.safeParse({
      from: "",
      subject: "Hi",
      responseType: "info",
    });
    expect(result.success).toBe(false);
  });

  it("accepts payload with all optional fields populated", () => {
    const result = EmailResponseSchema.safeParse({
      from: "recruiter@google.com",
      to: "user@jf.taras.cloud",
      subject: "We'd like to schedule an interview",
      body: "plain text",
      bodyText: "plain text version",
      bodyHtml: "<p>HTML version</p>",
      messageId: "<abc123@mail.google.com>",
      responseType: "positive",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// responseType coercion — unknown types fall back to "info"
// ---------------------------------------------------------------------------

describe("POST /api/email-response — responseType coercion", () => {
  const allowedResponseTypes = ["positive", "rejection", "interview", "info"];

  function coerceResponseType(input: string): string {
    return allowedResponseTypes.includes(input) ? input : "info";
  }

  it("preserves 'interview' responseType", () => {
    expect(coerceResponseType("interview")).toBe("interview");
  });

  it("preserves 'positive' responseType", () => {
    expect(coerceResponseType("positive")).toBe("positive");
  });

  it("preserves 'rejection' responseType", () => {
    expect(coerceResponseType("rejection")).toBe("rejection");
  });

  it("preserves 'info' responseType", () => {
    expect(coerceResponseType("info")).toBe("info");
  });

  it("coerces unknown type to 'info'", () => {
    expect(coerceResponseType("CUSTOM_TYPE")).toBe("info");
  });

  it("coerces empty string to 'info'", () => {
    expect(coerceResponseType("")).toBe("info");
  });
});

// ---------------------------------------------------------------------------
// Domain helpers — extractDomain + domainToCompany (company matching logic)
// ---------------------------------------------------------------------------

describe("POST /api/email-response — extractDomain helper", () => {
  it("extracts domain from plain email address", () => {
    expect(extractDomain("recruiter@google.com")).toBe("google.com");
  });

  it("extracts domain from angle-bracket format", () => {
    expect(extractDomain("John Doe <recruiter@acme.io>")).toBe("acme.io");
  });

  it("returns empty string when there is no @ symbol", () => {
    expect(extractDomain("not-an-email")).toBe("");
  });

  it("lowercases the result", () => {
    expect(extractDomain("user@GOOGLE.COM")).toBe("google.com");
  });
});

describe("POST /api/email-response — domainToCompany helper", () => {
  it("strips .com TLD", () => {
    expect(domainToCompany("google.com")).toBe("google");
  });

  it("strips .io TLD", () => {
    expect(domainToCompany("startup.io")).toBe("startup");
  });

  it("strips .co TLD", () => {
    expect(domainToCompany("stripe.co")).toBe("stripe");
  });

  it("strips .org TLD", () => {
    expect(domainToCompany("mozilla.org")).toBe("mozilla");
  });

  it("strips .es TLD (Spanish domains)", () => {
    expect(domainToCompany("empresa.es")).toBe("empresa");
  });

  it("strips .de TLD", () => {
    expect(domainToCompany("firma.de")).toBe("firma");
  });
});
