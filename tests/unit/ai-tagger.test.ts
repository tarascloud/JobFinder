/**
 * Unit tests for src/lib/ai/tagger.ts
 *
 * Pure function — no AI mock needed. Covers:
 *   - level detection (title priority, description fallback, years heuristic, default)
 *   - stack detection (multi-word, case-insensitive, deduplication, cap at 30)
 *   - industry detection (keyword match, fallback "other")
 *   - team size detection (returns undefined when no match)
 */
import { describe, it, expect } from "vitest";
import { tagVacancy } from "@/lib/ai/tagger";

describe("tagVacancy — level detection", () => {
  it("detects 'senior' from title even when description says junior", () => {
    const tags = tagVacancy(
      "Senior Backend Engineer",
      "Acme",
      "We are hiring a junior engineer to grow."
    );
    expect(tags.level).toBe("senior");
  });

  it("falls back to description when title has no level keyword", () => {
    const tags = tagVacancy(
      "Backend Engineer",
      "Acme",
      "We are looking for a staff engineer."
    );
    expect(tags.level).toBe("staff");
  });

  it("uses years-of-experience heuristic when no keywords match", () => {
    const tags = tagVacancy(
      "Engineer",
      "Acme",
      "Looking for someone with 8 years of experience."
    );
    expect(tags.level).toBe("senior");
  });

  it("defaults to 'mid' when nothing matches", () => {
    const tags = tagVacancy("Engineer", "Acme", "Build cool things.");
    expect(tags.level).toBe("mid");
  });

  it("maps 'principal' to 'staff'", () => {
    const tags = tagVacancy("Principal Engineer", "Acme", "");
    expect(tags.level).toBe("staff");
  });
});

describe("tagVacancy — stack detection", () => {
  it("detects multiple technologies, deduplicated", () => {
    const tags = tagVacancy(
      "Engineer",
      "Acme",
      "We use React, TypeScript, Node.js, PostgreSQL. React Native a plus."
    );
    expect(tags.stack).toContain("React");
    expect(tags.stack).toContain("TypeScript");
    expect(tags.stack).toContain("Node.js");
    expect(tags.stack).toContain("PostgreSQL");
    expect(tags.stack).toContain("React Native");
    // Dedupe — React mentioned twice, appears once
    expect(tags.stack.filter((s) => s === "React")).toHaveLength(1);
  });

  it("returns empty array when no tech keywords found", () => {
    const tags = tagVacancy("Manager", "Acme", "We sell widgets.");
    expect(tags.stack).toEqual([]);
  });

  it("case-insensitive matching", () => {
    const tags = tagVacancy("Engineer", "Acme", "we use REACT and Typescript");
    expect(tags.stack).toContain("React");
    expect(tags.stack).toContain("TypeScript");
  });

  it("caps stack at 30 items", () => {
    const allKeywords =
      "JavaScript TypeScript Python Java C# C++ Go Rust Ruby PHP Swift Kotlin " +
      "Scala Elixir Clojure Haskell React Angular Vue Svelte Next.js Nuxt Remix " +
      "Astro Gatsby Ember Backbone jQuery HTMX Alpine.js Tailwind Bootstrap " +
      "PostgreSQL MySQL MongoDB Redis Elasticsearch DynamoDB Cassandra";
    const tags = tagVacancy("Engineer", "Acme", allKeywords);
    expect(tags.stack.length).toBeLessThanOrEqual(30);
  });
});

describe("tagVacancy — industry detection", () => {
  it("detects fintech", () => {
    const tags = tagVacancy("Engineer", "Stripe", "Build payments infrastructure.");
    expect(tags.industry).toBe("fintech");
  });

  it("detects healthtech", () => {
    const tags = tagVacancy("Engineer", "Acme", "We build medical software.");
    expect(tags.industry).toBe("healthtech");
  });

  it("falls back to 'other' when no industry matches", () => {
    const tags = tagVacancy("Engineer", "Acme", "We do generic things.");
    expect(tags.industry).toBe("other");
  });
});

describe("tagVacancy — team size detection", () => {
  it("detects 'startup'", () => {
    const tags = tagVacancy("Engineer", "Acme", "Early-stage startup with seed funding.");
    expect(tags.teamSize).toBe("startup");
  });

  it("returns undefined when no team size keywords", () => {
    const tags = tagVacancy("Engineer", "Acme", "Build cool things.");
    expect(tags.teamSize).toBeUndefined();
  });

  it("detects enterprise", () => {
    const tags = tagVacancy("Engineer", "Megacorp", "Fortune 500 multinational corporation.");
    expect(tags.teamSize).toBe("enterprise");
  });
});
