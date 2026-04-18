import { describe, it, expect } from "vitest";
import { normalizeCompany, titleSimilarity, findDuplicate } from "@/lib/dedup";

describe("normalizeCompany", () => {
  it("lowercases and trims company name", () => {
    expect(normalizeCompany("  ACME  ")).toBe("acme");
  });

  it("strips legal suffixes like Inc", () => {
    expect(normalizeCompany("Acme Inc.")).toBe("acme");
  });

  it("strips Ltd suffix", () => {
    expect(normalizeCompany("TechCorp Ltd")).toBe("techcorp");
  });

  it("strips GmbH suffix", () => {
    expect(normalizeCompany("Muster GmbH")).toBe("muster");
  });

  it("handles company name without suffix", () => {
    expect(normalizeCompany("Google")).toBe("google");
  });
});

describe("titleSimilarity", () => {
  it("returns 1.0 for identical titles", () => {
    expect(titleSimilarity("Software Engineer", "Software Engineer")).toBe(1.0);
  });

  it("returns 1.0 when shorter title is a subset of longer", () => {
    // "Software Engineer" words are fully in "Senior Software Engineer"
    expect(titleSimilarity("Software Engineer", "Senior Software Engineer")).toBe(1.0);
  });

  it("returns 0 for completely different titles", () => {
    expect(titleSimilarity("Product Manager", "Data Analyst")).toBe(0);
  });

  it("returns 0 for empty strings", () => {
    expect(titleSimilarity("", "Software Engineer")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(titleSimilarity("FRONTEND DEVELOPER", "frontend developer")).toBe(1.0);
  });
});

describe("findDuplicate", () => {
  const now = new Date();

  it("returns null when no existing vacancies", () => {
    const vacancy = {
      title: "Software Engineer",
      company: "Google",
      postedAt: now,
      url: "https://example.com",
      platform: "linkedin" as const,
      externalId: "123",
    };
    expect(findDuplicate(vacancy, [])).toBeNull();
  });

  it("returns id of matching vacancy", () => {
    const vacancy = {
      title: "Software Engineer",
      company: "Google Inc.",
      postedAt: now,
      url: "https://example.com",
      platform: "indeed" as const,
      externalId: "456",
    };
    const existing = [
      { id: 99, company: "Google Inc", title: "Software Engineer", postedAt: now },
    ];
    expect(findDuplicate(vacancy, existing)).toBe(99);
  });

  it("returns null when company does not match", () => {
    const vacancy = {
      title: "Software Engineer",
      company: "Meta",
      postedAt: now,
      url: "https://example.com",
      platform: "linkedin" as const,
      externalId: "789",
    };
    const existing = [
      { id: 1, company: "Google", title: "Software Engineer", postedAt: now },
    ];
    expect(findDuplicate(vacancy, existing)).toBeNull();
  });

  it("returns null when titles are too different", () => {
    const vacancy = {
      title: "Product Designer",
      company: "Spotify",
      postedAt: now,
      url: "https://example.com",
      platform: "linkedin" as const,
      externalId: "111",
    };
    const existing = [
      { id: 2, company: "Spotify", title: "Backend Engineer", postedAt: now },
    ];
    expect(findDuplicate(vacancy, existing)).toBeNull();
  });

  it("returns null when vacancy has no company", () => {
    const vacancy = {
      title: "Software Engineer",
      company: null,
      postedAt: now,
      url: "https://example.com",
      platform: "linkedin" as const,
      externalId: "222",
    };
    const existing = [
      { id: 3, company: "Google", title: "Software Engineer", postedAt: now },
    ];
    expect(findDuplicate(vacancy, existing)).toBeNull();
  });
});
