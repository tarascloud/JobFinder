import { chromium } from "playwright";
import { type RegistrationContext, type RegistrationResult } from "./types";
import { randomDelay, fillField, safeClick, firstName, lastName } from "./helpers";

/**
 * Auto-register a new Wellfound (formerly AngelList Talent) account.
 * Registration URL: https://wellfound.com/join
 */
export async function registerWellfound(
  ctx: RegistrationContext
): Promise<RegistrationResult> {
  const log: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    log.push("Opening Wellfound signup page…");
    await page.goto("https://wellfound.com/join", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    // Fill first name
    log.push("Filling first name…");
    for (const sel of [
      'input[name="user[firstName]"]',
      'input[placeholder*="First"]',
      '#user_first_name',
    ]) {
      try {
        await fillField(page, sel, firstName(ctx.name), 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(200, 400);

    // Fill last name
    log.push("Filling last name…");
    for (const sel of [
      'input[name="user[lastName]"]',
      'input[placeholder*="Last"]',
      '#user_last_name',
    ]) {
      try {
        await fillField(page, sel, lastName(ctx.name), 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(200, 400);

    // Fill email
    log.push("Filling email…");
    for (const sel of [
      'input[name="user[email]"]',
      'input[type="email"]',
      '#user_email',
    ]) {
      try {
        await fillField(page, sel, ctx.jfEmail, 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(300, 500);

    // Fill password
    log.push("Filling password…");
    for (const sel of [
      'input[name="user[password]"]',
      'input[type="password"]',
      '#user_password',
    ]) {
      try {
        await fillField(page, sel, ctx.password, 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(300, 500);

    // Submit
    log.push("Submitting registration form…");
    await safeClick(page, 'input[type="submit"]', 5000)
      || await safeClick(page, 'button[type="submit"]', 3000)
      || await safeClick(page, 'button:has-text("Sign up")', 3000)
      || await safeClick(page, 'button:has-text("Create account")', 3000);

    await randomDelay(2500, 3500);

    const finalUrl = page.url();
    log.push(`URL after submit: ${finalUrl}`);

    if (finalUrl.includes("login") && finalUrl.includes("error")) {
      log.push("Account may already exist");
      return {
        status: "already_exists",
        message: `An account with ${ctx.jfEmail} may already exist on Wellfound.`,
        log,
      };
    }

    log.push("Registration submitted — email verification required");
    return {
      status: "needs_verification",
      message: `Registration submitted. Check ${ctx.jfEmail} for a verification email from Wellfound.`,
      requiresManual: false,
      log,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Error: ${msg}`);
    return {
      status: "failed",
      message: `Registration failed: ${msg}`,
      log,
    };
  } finally {
    await browser.close();
  }
}
