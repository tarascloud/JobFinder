/**
 * Boundary-level test: bodyHtml from upstream (CF Worker) must be passed
 * through sanitizeHtml() before persistence. We do not boot the route here —
 * we replicate the exact transformation the route performs to lock the
 * contract.
 */
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

const MAX_BODY_HTML = 50_000;

function persistBodyHtml(bodyHtml: string | undefined): string | null {
  if (!bodyHtml) return null;
  const capped = bodyHtml.length > MAX_BODY_HTML ? bodyHtml.substring(0, MAX_BODY_HTML) : bodyHtml;
  return sanitizeHtml(capped);
}

describe("email-response bodyHtml sanitization at trust boundary", () => {
  it("strips <script> from inbound email", () => {
    const persisted = persistBodyHtml(`<p>Hi</p><script>alert(1)</script>`);
    expect(persisted).not.toContain("<script>");
    expect(persisted).not.toContain("alert(1)");
  });

  it("strips onerror handler from img (would otherwise XSS on render)", () => {
    const persisted = persistBodyHtml(`<img src=x onerror="alert(1)">`);
    expect(persisted).not.toContain("onerror");
    expect(persisted).not.toContain("<img");
  });

  it("caps oversized bodyHtml at MAX_BODY_HTML", () => {
    const big = "<p>" + "a".repeat(60_000) + "</p>";
    const persisted = persistBodyHtml(big);
    expect(persisted).not.toBeNull();
    expect((persisted ?? "").length).toBeLessThanOrEqual(MAX_BODY_HTML + 100); // sanitizer adds small overhead
  });

  it("returns null for missing bodyHtml", () => {
    expect(persistBodyHtml(undefined)).toBeNull();
    expect(persistBodyHtml("")).toBeNull();
  });

  it("preserves safe content (common email markup)", () => {
    const persisted = persistBodyHtml(
      `<p>Hi <strong>Taras</strong>,</p><p>We would like to invite you. <a href="https://example.com">apply</a></p>`,
    );
    expect(persisted).toContain("<strong>Taras</strong>");
    expect(persisted).toContain(`href="https://example.com"`);
    expect(persisted).toContain(`rel="nofollow noopener noreferrer"`);
  });
});
