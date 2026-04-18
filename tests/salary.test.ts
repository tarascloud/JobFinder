import { describe, it, expect } from "vitest";
import {
  normalizeToEur,
  normalizeToAnnual,
  normalizeToEurAnnual,
  parseSalaryText,
  formatEurSalary,
} from "@/lib/salary";

describe("normalizeToEur", () => {
  it("returns EUR amount unchanged", () => {
    expect(normalizeToEur(1000, "EUR")).toBe(1000);
  });

  it("converts USD to EUR using rate 0.92", () => {
    expect(normalizeToEur(1000, "USD")).toBe(920);
  });

  it("is case-insensitive for currency code", () => {
    expect(normalizeToEur(1000, "usd")).toBe(920);
  });

  it("returns amount as-is for unknown currency", () => {
    expect(normalizeToEur(1000, "XYZ")).toBe(1000);
  });
});

describe("normalizeToAnnual", () => {
  it("returns annual amount unchanged", () => {
    expect(normalizeToAnnual(60000, "annual")).toBe(60000);
  });

  it("converts monthly to annual by multiplying by 12", () => {
    expect(normalizeToAnnual(5000, "monthly")).toBe(60000);
  });

  it("converts hourly to annual (40h/week * 52 weeks = 2080)", () => {
    expect(normalizeToAnnual(30, "hourly")).toBe(62400);
  });
});

describe("normalizeToEurAnnual", () => {
  it("converts USD monthly to EUR annual", () => {
    const result = normalizeToEurAnnual(5000, "USD", "monthly");
    // 5000 * 12 = 60000 USD annual, * 0.92 = 55200 EUR
    expect(result).toBe(55200);
  });
});

describe("parseSalaryText", () => {
  it("parses EUR range with k suffix", () => {
    const result = parseSalaryText("€60k - €80k per year");
    expect(result.min).toBe(60000);
    expect(result.max).toBe(80000);
    expect(result.currency).toBe("EUR");
    expect(result.period).toBe("annual");
  });

  it("detects monthly period", () => {
    const result = parseSalaryText("$5,000/month");
    expect(result.period).toBe("monthly");
    expect(result.currency).toBe("USD");
    expect(result.min).toBe(5000);
  });

  it("detects hourly period", () => {
    const result = parseSalaryText("$50/hr");
    expect(result.period).toBe("hourly");
  });

  it("returns empty result for empty string", () => {
    const result = parseSalaryText("");
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
  });

  it("parses currency from ISO code", () => {
    const result = parseSalaryText("100,000 USD");
    expect(result.currency).toBe("USD");
    expect(result.min).toBe(100000);
  });
});

describe("formatEurSalary", () => {
  it("returns null when both values are null", () => {
    expect(formatEurSalary(null, null)).toBeNull();
  });

  it("formats a range when min and max differ", () => {
    const result = formatEurSalary(60000, 80000);
    expect(result).toContain("EUR");
    expect(result).toContain("60");
    expect(result).toContain("80");
  });

  it("formats single value with tilde prefix", () => {
    const result = formatEurSalary(70000, 70000);
    expect(result).toMatch(/^~/);
    expect(result).toContain("EUR");
  });

  it("uses maxEur when minEur is null", () => {
    const result = formatEurSalary(null, 75000);
    expect(result).toContain("EUR");
  });
});
