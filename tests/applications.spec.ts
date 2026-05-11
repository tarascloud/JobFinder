/**
 * JobFinder — Applications pipeline E2E tests
 *
 * Uses demo mode (no OAuth needed). Demo mode sets a signed cookie and
 * returns user id=0 / email="demo@jf.taras.cloud".
 *
 * The applications page has:
 *  - Tabs: Queue, Applied, All Applications
 *  - Pipeline widget (stats): Queued, Approved, Applied, Interview, Offer
 *    (only shown when there are applications)
 *
 * Covered:
 *  1. /applications loads in demo mode (not crash/redirect)
 *  2. Tab navigation is visible (Queue, Applied, All)
 *  3. Pipeline stats widget shows correct stage labels when present
 *  4. No critical JS errors on the applications page
 */

import { test, expect, type Page } from '@playwright/test';

async function enterDemoMode(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('button[type="submit"]');
  await page.click('form button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 15_000,
  });
}

test.describe('Applications pipeline (demo mode)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('applications page loads without redirect to login', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1, h2, main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('tab navigation is visible', async ({ page }) => {
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    // The applications page has tabs for navigating between Queue/Applied/All.
    // Labels come from i18n but should contain key words.
    const tabList = page.getByRole('tablist').first();
    await expect(tabList).toBeVisible({ timeout: 8_000 });

    // At least 2 tabs should be present.
    const tabs = tabList.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount, 'Expected at least 2 application tabs').toBeGreaterThanOrEqual(2);
  });

  test('pipeline stats widget shows stage labels when applications exist', async ({ page }) => {
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    // The pipeline widget (ApplicationPipeline.tsx) is shown when allItems.length > 0.
    // In demo mode with no applications, it will be hidden.
    // We check: if visible, it must contain the correct stage labels.
    const pipelineStages = ['Queued', 'Approved', 'Applied', 'Interview', 'Offer'];

    // Check if pipeline widget is present at all.
    const firstStage = page.getByText('Queued', { exact: true }).first();
    const isPipelineVisible = await firstStage.isVisible().catch(() => false);

    if (isPipelineVisible) {
      // Pipeline shown — assert all 5 stages are present.
      for (const stage of pipelineStages) {
        await expect(
          page.getByText(stage, { exact: true }).first(),
          `Pipeline stage "${stage}" missing`,
        ).toBeVisible({ timeout: 5_000 });
      }
    } else {
      // No applications in demo mode — verify empty state message or tabs.
      // The page should still be functional (not crashed).
      const mainContent = page.locator('main, [role="main"]').first();
      await expect(mainContent).toBeVisible({ timeout: 5_000 });
    }
  });

  test('can switch between tabs without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await enterDemoMode(page);
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    // Click through available tabs.
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      // Wait for the tab panel to become visible instead of a fixed timeout
      await page.waitForSelector('[role="tabpanel"]:not([hidden])', { state: 'visible' });
    }

    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning:'),
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('no critical JS errors on applications page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await enterDemoMode(page);
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning:'),
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });
});
