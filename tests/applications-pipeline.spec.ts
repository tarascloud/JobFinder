/**
 * JobFinder — Applications pipeline transition E2E (mutating).
 *
 * Flow (demo mode, localhost only):
 *   1. Queue a vacancy from /vacancies ("Queue for Apply")
 *   2. /applications Queue tab shows the new item
 *   3. Approve it → status becomes "approved", pipeline stats update
 *   4. Revert to queued (Cancel Approve) → back to queued
 *   5. afterAll: delete applications created by this run (via Prisma)
 *
 * IMPORTANT: this spec MUTATES the DB (demo user id=0). It must run only
 * against a local server backed by a dev DB with the demo seed — never prod.
 * It is gated behind JF_PIPELINE_E2E=1 because:
 *   - on Mac there is no local JF server/DB by default;
 *   - cleanup requires DATABASE_URL to be set for the test runner.
 *
 * Run on Mini/CI:
 *   JF_PIPELINE_E2E=1 DATABASE_URL=postgresql://... npx playwright test tests/applications-pipeline.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

const ENABLED = process.env.JF_PIPELINE_E2E === "1";
const DEMO_USER_ID = 0;

// Prisma client is only loaded when the suite actually runs and cleanup is possible.
type PrismaLike = {
  application: {
    findMany: (args: unknown) => Promise<Array<{ id: number }>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  $disconnect: () => Promise<void>;
};

async function getPrisma(): Promise<PrismaLike | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { PrismaClient } = await import("../src/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    }) as unknown as PrismaLike;
  } catch {
    return null;
  }
}

async function enterDemoMode(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('button[type="submit"]');
  await page.click('form button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 15_000,
  });
}

test.describe("Applications pipeline transition (demo mode, mutating)", () => {
  test.skip(
    !ENABLED,
    "Mutating pipeline E2E — requires local JF server + dev DB with demo seed. " +
      "Enable with JF_PIPELINE_E2E=1 (Mini/CI). Cleanup needs DATABASE_URL.",
  );

  // IDs that existed before the test — everything else for demo user is ours.
  let preExistingIds: number[] = [];

  test.beforeAll(async () => {
    const prisma = await getPrisma();
    if (!prisma) return;
    const rows = await prisma.application.findMany({
      where: { userId: DEMO_USER_ID },
      select: { id: true },
    });
    preExistingIds = rows.map((r) => r.id);
    await prisma.$disconnect();
  });

  test.afterAll(async () => {
    const prisma = await getPrisma();
    if (!prisma) {
      console.warn(
        "[applications-pipeline] DATABASE_URL not set — could not clean up " +
          "applications created for demo user; clean manually.",
      );
      return;
    }
    const result = await prisma.application.deleteMany({
      where: { userId: DEMO_USER_ID, id: { notIn: preExistingIds } },
    });
    console.log(`[applications-pipeline] cleanup: deleted ${result.count} application(s)`);
    await prisma.$disconnect();
  });

  test("queue a vacancy → approve → stats update → revert", async ({ page }) => {
    test.setTimeout(180_000); // cover-letter generation can be slow

    await enterDemoMode(page);

    // --- 1. Queue a vacancy from /vacancies ---
    await page.goto("/vacancies");
    await page.waitForLoadState("networkidle");

    const queueButton = page
      .getByRole("button", { name: "Queue for Apply" })
      .first();
    await expect(
      queueButton,
      "Demo seed must contain at least one un-queued vacancy",
    ).toBeVisible({ timeout: 15_000 });
    await queueButton.click();

    // Queueing triggers cover-letter generation server-side; wait until the
    // button leaves its loading state (disappears or re-enables elsewhere).
    await expect(queueButton).not.toBeDisabled({ timeout: 120_000 });

    // --- 2. The item appears in the Apply Queue ---
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");

    const approveButton = page
      .getByRole("button", { name: "Approve", exact: true })
      .first();
    await expect(
      approveButton,
      "Queued application must appear in the Queue tab",
    ).toBeVisible({ timeout: 15_000 });

    // --- 3. Approve → status approved + pipeline stats reflect it ---
    await approveButton.click();
    const cancelApprove = page
      .getByRole("button", { name: "Cancel Approve" })
      .first();
    await expect(cancelApprove).toBeVisible({ timeout: 30_000 });

    // Pipeline widget shows the Approved stage with count >= 1
    const approvedStage = page
      .locator("div.rounded-xl", { hasText: "Approved" })
      .first();
    await expect(approvedStage).toBeVisible({ timeout: 10_000 });
    const approvedCount = Number(
      await approvedStage.locator("p").first().innerText(),
    );
    expect(approvedCount, "Approved counter must be >= 1").toBeGreaterThanOrEqual(1);

    // --- 4. Transition back: approved → queued (Cancel Approve) ---
    await cancelApprove.click();
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("no critical JS errors during pipeline interaction", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await enterDemoMode(page);
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:"),
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });
});
