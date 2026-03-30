import { chromium } from "playwright";
import { type RegistrationContext, type RegistrationResult } from "./types";
import { randomDelay, fillField, safeClick, firstName, lastName } from "./helpers";

/**
 * Auto-register a new Indeed account using the JF email.
 * Indeed registration: https://secure.indeed.com/account/register
 *
 * Indeed typically sends a verification email; no phone required for basic account.
 */
export async function registerIndeed(
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

    log.push("Opening Indeed registration page…");
    await page.goto("https://secure.indeed.com/account/register", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    const currentUrl = page.url();

    // Indeed may redirect to a login page
    if (currentUrl.includes("login") || currentUrl.includes("signin")) {
      const createLink = await safeClick(page, 'a[href*="register"]', 3000)
        || await safeClick(page, 'a:has-text("Create account")', 3000)
        || await safeClick(page, 'a:has-text("Sign up")', 3000);
      if (!createLink) {
        log.push("Could not find create account link");
      }
      await randomDelay(1500, 2500);
    }

    // Fill email
    log.push("Filling email…");
    const emailFilled = await (async () => {
      for (const sel of ['input[name="email"]', '#emailInput', 'input[type="email"]']) {
        try {
          await fillField(page, sel, ctx.jfEmail, 5000);
          return true;
        } catch {
          // try next selector
        }
      }
      return false;
    })();

    if (!emailFilled) {
      log.push("Email field not found");
      return {
        status: "failed",
        message: "Could not find email field on Indeed registration page. Indeed may have changed their layout.",
        requiresManual: true,
        manualInstructions: `Register manually at https://secure.indeed.com/account/register with ${ctx.jfEmail}`,
        log,
      };
    }

    await randomDelay(300, 500);

    // Fill password
    log.push("Filling password…");
    for (const sel of ['input[name="password"]', '#passwordInput', 'input[type="password"]']) {
      try {
        await fillField(page, sel, ctx.password, 5000);
        break;
      } catch {
        // try next
      }
    }
    await randomDelay(200, 400);

    // Fill name fields if present
    const hasFirstName = await page.$('#firstNameInput') !== null || await page.$('input[name="firstName"]') !== null;
    if (hasFirstName) {
      log.push("Filling first name…");
      for (const sel of ['#firstNameInput', 'input[name="firstName"]']) {
        try {
          await fillField(page, sel, firstName(ctx.name), 5000);
          break;
        } catch { /* try next */ }
      }
      await randomDelay(200, 400);
      log.push("Filling last name…");
      for (const sel of ['#lastNameInput', 'input[name="lastName"]']) {
        try {
          await fillField(page, sel, lastName(ctx.name), 5000);
          break;
        } catch { /* try next */ }
      }
      await randomDelay(200, 400);
    }

    // Submit
    log.push("Submitting registration form…");
    await safeClick(page, 'button[type="submit"]', 5000)
      || await safeClick(page, '#createAccountButton', 3000)
      || await safeClick(page, 'button:has-text("Create account")', 3000);

    await randomDelay(2500, 3500);

    const finalUrl = page.url();
    log.push(`URL after submit: ${finalUrl}`);

    // Check for CAPTCHA
    const hasCaptcha =
      (await page.$("iframe[src*='captcha']")) !== null ||
      (await page.$("iframe[src*='hcaptcha']")) !== null ||
      (await page.$("[data-cy='captcha']")) !== null;

    if (hasCaptcha) {
      log.push("CAPTCHA detected");
      return {
        status: "captcha_required",
        message: "CAPTCHA required. Please complete Indeed registration manually.",
        requiresManual: true,
        manualInstructions: `Open https://secure.indeed.com/account/register and register with email: ${ctx.jfEmail}`,
        log,
      };
    }

    log.push("Registration submitted — email verification required");
    return {
      status: "needs_verification",
      message: `Registration submitted. Check ${ctx.jfEmail} for a verification email from Indeed.`,
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
