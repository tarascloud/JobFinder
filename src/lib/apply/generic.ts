import { chromium, type Browser } from "playwright";
import { type ApplyContext, type ApplyResult } from "./types";
import { takeScreenshot } from "./helpers";

export async function applyGeneric(ctx: ApplyContext): Promise<ApplyResult> {
  const log: string[] = [];
  let browser: Browser | null = null;
  let screenshotPath: string | undefined;

  try {
    log.push(`Manual apply required for platform: ${ctx.vacancy.platform}`);
    log.push(`Opening vacancy page: ${ctx.vacancy.url}`);

    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    const page = await context.newPage();

    await page.goto(ctx.vacancy.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for page to render
    await page.waitForTimeout(3000);

    screenshotPath = await takeScreenshot(page, `generic-${ctx.vacancy.platform}`);
    log.push(`Screenshot saved: ${screenshotPath}`);
    log.push(`Vacancy: ${ctx.vacancy.title} at ${ctx.vacancy.company}`);
    log.push(`Manual apply required for ${ctx.vacancy.platform}`);

    return {
      success: false,
      screenshotPath,
      log,
      error: `Manual apply required for ${ctx.vacancy.platform}`,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    log.push(`Error opening vacancy page: ${errorMsg}`);
    return {
      success: false,
      screenshotPath,
      log,
      error: errorMsg,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
