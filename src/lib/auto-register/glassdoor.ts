import { chromium } from "playwright";
import { type RegistrationContext, type RegistrationResult } from "./types";
import { randomDelay, fillField, safeClick, firstName, lastName } from "./helpers";

/**
 * Auto-register a new Glassdoor account using the JF email.
 * Registration URL: https://www.glassdoor.com/profile/joinGlassdoor.htm
 */
export async function registerGlassdoor(
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

    log.push("Opening Glassdoor signup page…");
    await page.goto("https://www.glassdoor.com/profile/joinGlassdoor.htm", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    // Fill first name
    log.push("Filling first name…");
    for (const sel of ['#firstName', 'input[name="firstName"]', 'input[placeholder*="First"]']) {
      try {
        await fillField(page, sel, firstName(ctx.name), 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(200, 400);

    // Fill last name
    log.push("Filling last name…");
    for (const sel of ['#lastName', 'input[name="lastName"]', 'input[placeholder*="Last"]']) {
      try {
        await fillField(page, sel, lastName(ctx.name), 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(200, 400);

    // Fill email
    log.push("Filling email…");
    for (const sel of ['#emailInput', 'input[name="email"]', 'input[type="email"]']) {
      try {
        await fillField(page, sel, ctx.jfEmail, 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(300, 500);

    // Fill password
    log.push("Filling password…");
    for (const sel of ['#passwordInput', 'input[name="password"]', 'input[type="password"]']) {
      try {
        await fillField(page, sel, ctx.password, 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(300, 500);

    // Accept terms if checkbox present
    const termsCheckbox = await page.$('input[name="gdprTC"]')
      || await page.$('input[name="agreeToTerms"]')
      || await page.$('#termsCheckbox');
    if (termsCheckbox) {
      const checked = await termsCheckbox.isChecked();
      if (!checked) {
        await termsCheckbox.check();
        log.push("Accepted terms");
        await randomDelay(200, 400);
      }
    }

    // Submit
    log.push("Submitting registration form…");
    await safeClick(page, 'button[type="submit"]', 5000)
      || await safeClick(page, '#submitBtn', 3000)
      || await safeClick(page, 'button:has-text("Sign Up")', 3000)
      || await safeClick(page, 'button:has-text("Join")', 3000);

    await randomDelay(2500, 3500);

    const finalUrl = page.url();
    log.push(`URL after submit: ${finalUrl}`);

    const hasCaptcha = (await page.$("iframe[src*='captcha']")) !== null
      || (await page.$("iframe[title*='captcha']")) !== null;

    if (hasCaptcha) {
      log.push("CAPTCHA detected");
      return {
        status: "captcha_required",
        message: "CAPTCHA required. Please complete Glassdoor registration manually.",
        requiresManual: true,
        manualInstructions: `Open https://www.glassdoor.com/profile/joinGlassdoor.htm and register with email: ${ctx.jfEmail}`,
        log,
      };
    }

    log.push("Registration submitted — email verification required");
    return {
      status: "needs_verification",
      message: `Registration submitted. Check ${ctx.jfEmail} for a verification email from Glassdoor.`,
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
