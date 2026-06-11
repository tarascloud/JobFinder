import { defineConfig, devices } from "@playwright/test";

/**
 * Base URL resolution:
 * - Default: http://localhost:3456 (local dev server) — tests may mutate DB.
 * - Override via TEST_BASE_URL env var (e.g., staging URL).
 *
 * IMPORTANT: do NOT default to prod (https://jobfinder.taras.cloud) —
 * Playwright tests create/delete data and would corrupt prod DB.
 * Use the `smoke` project (read-only) for prod smoke checks.
 *
 * Usage:
 *   npx playwright test                                     # local
 *   TEST_BASE_URL=https://staging.example.com npx playwright test
 *   npx playwright test --project=smoke                     # prod smoke (read-only)
 */
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3456";
const PROD_URL = "https://jobfinder.taras.cloud";

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      // Read-only smoke check against prod.
      // Match only smoke specs (tests/smoke.spec.ts) — never run mutating
      // tests here. (Previous regex required a tests/smoke/ directory that
      // does not exist, so the project silently matched 0 tests.)
      name: "smoke",
      testMatch: /smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.TEST_BASE_URL || PROD_URL,
      },
    },
  ],
});
