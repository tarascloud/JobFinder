import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Prevention for hardcoded-strings regressions: every locale file must
// expose exactly the same set of keys (en is the reference).

const LOCALES = ["en", "uk", "es"] as const;

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function loadLocale(locale: string): Record<string, unknown> {
  const file = path.resolve(__dirname, "../../messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf-8"));
}

describe("i18n key parity", () => {
  const reference = new Set(flattenKeys(loadLocale("en")));

  it.each(LOCALES.filter((l) => l !== "en"))("%s has the same keys as en", (locale) => {
    const keys = new Set(flattenKeys(loadLocale(locale)));
    const missing = [...reference].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !reference.has(k));
    expect(missing, `missing keys in ${locale}.json`).toEqual([]);
    expect(extra, `extra keys in ${locale}.json`).toEqual([]);
  });
});
