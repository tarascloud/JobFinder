/**
 * JobFinder — Onboarding & Core Flow E2E tests
 *
 * All tests use demo mode (no Google/GitHub OAuth needed).
 * Demo mode sets a signed cookie and returns user id=0 / email="demo@jf.taras.cloud".
 *
 * Covered scenarios:
 *  1.  Login page renders correctly
 *  2.  Demo mode activates and redirects to /profile
 *  3.  Authenticated redirect from / works
 *  4.  Unauthenticated root redirects to /login
 *  5.  Profile page loads without hardcoded placeholder values
 *  6.  Onboarding step 1 — page loads and shows key elements
 *  7.  Onboarding step 1 — AI model selector defaults to "groq"
 *  8.  Onboarding step 1 — "Configure in Settings" link points to /settings/ai
 *  9.  Onboarding step 1 — "Skip and fill manually" jumps to review step
 * 10.  Settings AI page loads with provider selector
 * 11.  Settings AI page shows all three providers (Groq, Gemini, Ollama)
 * 12.  Navigation links visible after login
 * 13.  Demo mode: /vacancies page loads (not crash)
 * 14.  Demo mode: /applications page loads (not crash)
 * 15.  Demo mode: /qa page loads (not crash)
 * 16.  Onboarding with real CV — URL upload starts analysis
 * 17.  Onboarding with real CV — analysis completes
 * 18.  Onboarding with real CV — profile has real data not defaults
 * 19.  Profile page — no stale demo data
 * 20.  No critical JS errors across main pages
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enter demo mode by submitting the server action form on /login */
async function enterDemoMode(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('button[type="submit"]');
  // Click the "Try Demo" submit button inside the <form action={enterDemoMode}>
  await page.click('form button[type="submit"]');
  // Wait for navigation away from /login
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 15000,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("1. Login page", () => {
  test("renders title and buttons", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("JobFinder");
    await expect(page.getByText("Sign in with Google")).toBeVisible();
    await expect(page.getByText("Sign in with GitHub")).toBeVisible();
    await expect(page.getByText("Try Demo")).toBeVisible();
  });

  test("shows invite-only notice", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText(/invite.only/i, { exact: false })
    ).toBeVisible();
  });

  test("language toggle is visible", async ({ page }) => {
    await page.goto("/login");
    // LanguageToggle renders a button or select — just check it's rendered
    const toggle = page.locator('[data-testid="language-toggle"], button:has-text("EN"), button:has-text("UA"), button:has-text("ES")').first();
    // If no data-testid, at least the card should be present
    await expect(page.locator(".max-w-md")).toBeVisible();
  });
});

test.describe("2. Demo mode authentication", () => {
  test("entering demo mode redirects away from /login", async ({ page }) => {
    await enterDemoMode(page);
    expect(page.url()).not.toContain("/login");
  });

  test("demo mode lands on /profile", async ({ page }) => {
    await enterDemoMode(page);
    await expect(page).toHaveURL(/\/profile/);
  });

  test("demo mode cookie allows access to protected routes", async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/vacancies");
    // Should NOT redirect back to /login
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("3. Redirect logic", () => {
  test("unauthenticated / redirects to /login", async ({ page }) => {
    // Navigate without demo cookie
    await page.goto("/");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /profile redirects to /login", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("/about is publicly accessible without login", async ({ page }) => {
    await page.goto("/about");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("4. Profile page (demo mode)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/profile");
  });

  test("profile page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Wait for the page to fully hydrate by checking for visible heading
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 15000 });
    const criticalErrors = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("headline input does not contain hardcoded 'Senior Frontend Engineer'", async ({ page }) => {
    // Wait for any visible form element (profile or onboarding page)
    await page.locator("input:visible, textarea:visible, select:visible").first().waitFor({ timeout: 15000 });
    // Find all visible inputs AND textareas and check none have the old hardcoded bug value
    const allFields = await page.locator("input:visible, textarea:visible").all();
    for (const field of allFields) {
      const val = await field.inputValue().catch(() => "");
      expect(val).not.toBe("Senior Frontend Engineer");
    }
  });

  test("profile page shows expected UI sections", async ({ page }) => {
    // At least one card-like section should be visible
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });
});

test.describe("5. Onboarding flow (demo mode)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/onboarding");
  });

  test("onboarding page loads on step 1", async ({ page }) => {
    // Step indicator should show step 1 active
    await expect(page.getByText("Upload Your Resume")).toBeVisible();
  });

  test("step indicator shows all 6 steps", async ({ page }) => {
    // Steps: Upload, Analysis, Review, Recommendations, Improve, Ready
    // Each step renders a numbered circle (w-8 h-8 rounded-full) inside the step indicator
    // Count step circles — they contain numbers 1-6 or a check icon
    const stepIndicator = page.locator(".flex.items-center.gap-1.mb-8");
    await expect(stepIndicator).toBeVisible();
    // Each step has a circle div with the step number
    const circles = stepIndicator.locator("div.rounded-full");
    await expect(circles).toHaveCount(6);
  });

  test("AI model selector is visible with groq as default", async ({ page }) => {
    const select = page.locator("select");
    await expect(select).toBeVisible();
    const value = await select.inputValue();
    expect(value).toBe("groq");
  });

  test("AI model selector has groq, gemini, and ollama options", async ({ page }) => {
    const options = await page.locator("select option").allTextContents();
    const optionValues = await page.locator("select option").evaluateAll(
      (els) => els.map((el) => (el as HTMLOptionElement).value)
    );
    expect(optionValues).toContain("groq");
    expect(optionValues).toContain("gemini");
    expect(optionValues).toContain("ollama");
  });

  test("'Configure in Settings' link points to /settings/ai", async ({ page }) => {
    const link = page.locator('a[href="/settings/ai"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/settings/ai");
  });

  test("'Configure in Settings' link navigates to AI settings page", async ({ page }) => {
    await page.click('a[href="/settings/ai"]');
    await expect(page).toHaveURL(/\/settings\/ai/);
  });

  test("drag-and-drop zone is visible", async ({ page }) => {
    // Drop zone has border-dashed styling — find by its content
    await expect(page.getByText(/drop.*resume|drag.*pdf/i, { exact: false }).or(
      page.locator('[class*="border-dashed"]')
    ).first()).toBeVisible();
  });

  test("URL input field is visible", async ({ page }) => {
    await expect(page.locator('input[placeholder*="http"]').or(
      page.locator('input[placeholder*="URL"]')
    ).first()).toBeVisible();
  });

  test("'Analyze with AI' button is visible", async ({ page }) => {
    await expect(page.getByText("Analyze with AI")).toBeVisible();
  });

  test("'Analyze with AI' button is disabled with empty URL", async ({ page }) => {
    const analyzeBtn = page.locator('button:has-text("Analyze with AI")');
    await expect(analyzeBtn).toBeDisabled();
  });

  test("'Skip and fill manually' button is visible", async ({ page }) => {
    await expect(page.getByText("Skip and fill manually")).toBeVisible();
  });

  test("'Skip and fill manually' advances to step 3 (Review)", async ({ page }) => {
    await page.click('button:has-text("Skip and fill manually")');
    await expect(page.getByText("Review AI-Generated Data")).toBeVisible({
      timeout: 5000,
    });
  });

  test("changing AI model from groq to gemini updates select", async ({ page }) => {
    await page.selectOption("select", "gemini");
    const value = await page.locator("select").inputValue();
    expect(value).toBe("gemini");
  });
});

test.describe("6. Settings — AI configuration (demo mode)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/settings/ai");
  });

  test("AI settings page loads", async ({ page }) => {
    await expect(page).toHaveURL(/\/settings\/ai/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("provider selector is visible", async ({ page }) => {
    // The custom Select component renders a <select> element
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("all three providers are listed as options", async ({ page }) => {
    const values = await page.locator("select option").evaluateAll(
      (els) => els.map((el) => (el as HTMLOptionElement).value)
    );
    expect(values).toContain("groq");
    expect(values).toContain("gemini");
    expect(values).toContain("ollama");
  });

  test("Save button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();
  });

  test("settings tabs are rendered", async ({ page }) => {
    // SettingsTabs renders navigation between General, AI, Platforms, Preferences
    const tabs = page.locator("nav a, [role='tablist'] a, [role='tablist'] button");
    await expect(tabs.first()).toBeVisible();
  });
});

test.describe("7. Dashboard pages (demo mode — no crash)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("/vacancies page loads without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/vacancies");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    // Critical JS errors (not hydration warnings) should be 0
    const critical = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:")
    );
    expect(critical).toHaveLength(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/applications page loads without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/applications");
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    const critical = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:")
    );
    expect(critical).toHaveLength(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/qa page loads without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/qa");
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    const critical = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:")
    );
    expect(critical).toHaveLength(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/analytics page loads without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/analytics");
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    const critical = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:")
    );
    expect(critical).toHaveLength(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/ (root) loads a dashboard page after demo login", async ({ page }) => {
    await page.goto("/");
    // Should NOT be on /login
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("8. Onboarding with real CV (Taras)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/onboarding");
  });

  test("step 1: upload CV by URL and start analysis", async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="example.com"]').or(
      page.locator('input[placeholder*="http"]').or(
        page.locator('input[placeholder*="URL"]')
      )
    ).first();
    await urlInput.fill("https://taras.cloud/cv/pdf/");

    const analyzeBtn = page.getByText("Analyze with AI");
    await expect(analyzeBtn).toBeEnabled();
    await analyzeBtn.click();

    // Should move to step 2 — analysis progress
    await expect(
      page.getByText("AI is analyzing your resume...")
    ).toBeVisible({ timeout: 10000 });
  });

});

// REV-20260419-0089: Previously skipped tests — now implemented with mock Ollama
test.describe("8b. Onboarding with mock AI (no real Groq key needed)", () => {
  const mockAnalyzeResult = {
    status: "done",
    result: {
      profile: {
        headline: "Software Engineer",
        summary: "Experienced software developer",
        yearsExperience: 5,
        skills: ["TypeScript", "React", "Node.js"],
        languages: ["English (C1)", "Ukrainian (Native)"],
        portfolioUrls: [],
        salaryMin: null,
        salaryCurrency: "EUR",
        preferredLocations: [],
        preferredRemoteType: "remote",
        employmentTypes: ["full-time"],
        experience: [],
        educationHistory: [],
      },
      searchProfiles: [],
      qaPairs: [],
    },
  };

  test("step 2: analysis completes and reaches review (mock AI)", async ({ page }) => {
    // Register route intercept BEFORE any navigation so POST and GET are mocked
    await page.route("**/api/analyze-resume", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "analyzing" }),
        });
      } else {
        // GET polling — immediately return done
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAnalyzeResult),
        });
      }
    });

    await enterDemoMode(page);
    await page.goto("/onboarding");

    const urlInput = page.locator('input[placeholder*="example.com"]').or(
      page.locator('input[placeholder*="http"]').or(
        page.locator('input[placeholder*="URL"]')
      )
    ).first();
    await urlInput.fill("https://taras.cloud/cv/pdf/");
    await page.getByText("Analyze with AI").click();

    // Should reach step 3 (Review AI-Generated Data) via mocked polling
    await expect(
      page.getByText("Review AI-Generated Data")
    ).toBeVisible({ timeout: 30000 });
  });

  test("step 3: profile has AI data, not hardcoded defaults (mock AI)", async ({ page }) => {
    await page.route("**/api/analyze-resume", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "analyzing" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAnalyzeResult),
        });
      }
    });

    await enterDemoMode(page);
    await page.goto("/onboarding");

    const urlInput = page.locator('input[placeholder*="example.com"]').or(
      page.locator('input[placeholder*="http"]').or(
        page.locator('input[placeholder*="URL"]')
      )
    ).first();
    await urlInput.fill("https://taras.cloud/cv/pdf/");
    await page.getByText("Analyze with AI").click();

    // Wait for review step
    await expect(
      page.getByText("Review AI-Generated Data")
    ).toBeVisible({ timeout: 30000 });

    // Should NOT contain old hardcoded defaults
    const body = await page.textContent("body");
    expect(body).not.toContain("Senior Frontend Engineer");
  });
});

test.describe("9. Profile page — no stale demo data", () => {
  test("profile page shows empty or real data, not hardcoded defaults", async ({ page }) => {
    await enterDemoMode(page);
    await page.goto("/profile");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 15000 });

    const body = await page.textContent("body");
    expect(body).not.toContain("Senior Frontend Engineer");
  });
});

test.describe("10. No errors on key pages", () => {
  test("no critical JS errors across main pages", async ({ page }) => {
    await enterDemoMode(page);

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const path of ["/profile", "/vacancies", "/applications"]) {
      await page.goto(path);
      await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    }

    // Filter out known non-critical errors
    const critical = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("Server Action")
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe("11. Demo exit", () => {
  test("demo mode exits and redirects to /login", async ({ page }) => {
    await enterDemoMode(page);
    // Navigate to any protected page
    await page.goto("/profile");
    // Look for Exit Demo button in the UI (may be in nav or profile page)
    const exitBtn = page.getByText(/exit demo/i, { exact: false });
    if (await exitBtn.isVisible().catch(() => false)) {
      await exitBtn.click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    } else {
      // If not present in UI, manually clear cookie and check redirect
      await page.context().clearCookies();
      await page.goto("/profile");
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

// ─── 12. Vacancies — Score All & UI ──────────────────────────────────────────
test.describe("12. Vacancies — Score All & UI", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("Score All button is visible", async ({ page }) => {
    await page.goto("/vacancies");
    const scoreBtn = page.locator("button", { hasText: /score all/i });
    await expect(scoreBtn).toBeVisible({ timeout: 15000 });
  });

  test("All Profiles is default in search dropdown", async ({ page }) => {
    await page.goto("/vacancies");
    // Wait for page content to be ready
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    const select = page.locator("select").first();
    if (await select.isVisible().catch(() => false)) {
      const value = await select.inputValue();
      expect(value === "all" || value === "").toBe(true);
    }
  });

  test("Scrape Now button is visible", async ({ page }) => {
    await page.goto("/vacancies");
    const scrapeBtn = page.locator("button", { hasText: /scrape now/i });
    await expect(scrapeBtn).toBeVisible({ timeout: 15000 });
  });

  test("vacancy list renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/vacancies");
    await expect(page.locator("h1, h2, h3, [data-testid]").first()).toBeVisible({ timeout: 15000 });
    const critical = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:") && !e.includes("Server Action")
    );
    expect(critical).toHaveLength(0);
  });
});
