import { describe, it, expect } from "vitest";
import { isPublic, csrfExempt } from "@/middleware";

describe("isPublic", () => {
  it("matches exact public paths", () => {
    expect(isPublic("/login")).toBe(true);
    expect(isPublic("/api/scrape")).toBe(true);
    expect(isPublic("/api/scrape-hourly")).toBe(true);
    expect(isPublic("/api/apply")).toBe(true);
  });

  it("matches sub-paths with slash", () => {
    expect(isPublic("/api/auth/signin")).toBe(true);
    expect(isPublic("/api/scrape-hourly/anything")).toBe(true);
  });

  it("does NOT match prefix without slash boundary", () => {
    expect(isPublic("/api/scrape-stream")).toBe(false);
    expect(isPublic("/loginx")).toBe(false);
    expect(isPublic("/aboutus")).toBe(false);
  });

  it("does not match protected routes", () => {
    expect(isPublic("/dashboard")).toBe(false);
    expect(isPublic("/api/vacancies")).toBe(false);
  });
});

describe("csrfExempt", () => {
  it("exempts bearer-auth cron routes exactly", () => {
    expect(csrfExempt("/api/scrape")).toBe(true);
    expect(csrfExempt("/api/scrape-hourly")).toBe(true);
    expect(csrfExempt("/api/apply")).toBe(true);
  });

  it("exempts sub-paths with slash boundary", () => {
    expect(csrfExempt("/api/auth/callback/google")).toBe(true);
    expect(csrfExempt("/api/scrape/run")).toBe(true);
  });

  it("does NOT exempt /api/scrape-stream (cookie-session route)", () => {
    expect(csrfExempt("/api/scrape-stream")).toBe(false);
  });

  it("does NOT exempt other cookie-session API routes", () => {
    expect(csrfExempt("/api/vacancies")).toBe(false);
    expect(csrfExempt("/api/applyx")).toBe(false);
  });
});
