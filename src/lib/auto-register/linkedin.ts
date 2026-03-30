import { chromium } from "playwright";
import { type RegistrationContext, type RegistrationResult } from "./types";
import { randomDelay, fillField, safeClick, firstName, lastName } from "./helpers";

/**
 * Auto-register a new LinkedIn account using the JF email.
 * LinkedIn registration page: https://www.linkedin.com/signup/cold-join
 *
 * CAPTCHA NOTE: LinkedIn uses hCaptcha/Arkose Labs on registration.
 * The script fills all fields and submits; if CAPTCHA appears the status
 * becomes "captcha_required" and the user must complete it manually.
 * After CAPTCHA + email verification the account status transitions to
 * "needs_verification" → user confirms email → status → "registered".
 */
export async function registerLinkedIn(
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

    log.push("Opening LinkedIn signup page…");
    await page.goto("https://www.linkedin.com/signup/cold-join", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    // Fill email
    log.push("Filling email…");
    try {
      await fillField(page, 'input[name="session_key"]', ctx.jfEmail, 10000);
    } catch {
      await fillField(page, '#email-address', ctx.jfEmail, 5000);
    }
    await randomDelay(300, 600);

    // Click continue / next (may be a two-step form)
    const continueClicked = await safeClick(page, 'button[data-id="join-form-submit"]', 3000)
      || await safeClick(page, 'button[type="submit"]', 3000);
    if (!continueClicked) {
      log.push("Could not find submit button after email step");
    }
    await randomDelay(1500, 2500);

    // Check if we're on password step or full form
    const passwordVisible = await page.$('input[name="session_password"]') !== null
      || await page.$('#password') !== null;

    if (passwordVisible) {
      log.push("Filling password…");
      try {
        await fillField(page, 'input[name="session_password"]', ctx.password, 5000);
      } catch {
        await fillField(page, '#password', ctx.password, 5000);
      }
      await randomDelay(300, 500);
    }

    // Fill first name
    const firstNameVisible = await page.$('#first-name') !== null
      || await page.$('input[name="firstName"]') !== null;
    if (firstNameVisible) {
      log.push("Filling first name…");
      try {
        await fillField(page, '#first-name', firstName(ctx.name), 5000);
      } catch {
        await fillField(page, 'input[name="firstName"]', firstName(ctx.name), 5000);
      }
      await randomDelay(200, 400);
    }

    // Fill last name
    const lastNameVisible = await page.$('#last-name') !== null
      || await page.$('input[name="lastName"]') !== null;
    if (lastNameVisible) {
      log.push("Filling last name…");
      try {
        await fillField(page, '#last-name', lastName(ctx.name), 5000);
      } catch {
        await fillField(page, 'input[name="lastName"]', lastName(ctx.name), 5000);
      }
      await randomDelay(200, 400);
    }

    // Submit the form
    log.push("Submitting registration form…");
    const submitted = await safeClick(page, 'button[data-id="join-form-submit"]', 3000)
      || await safeClick(page, 'button[type="submit"]', 3000);

    await randomDelay(2000, 3000);

    const currentUrl = page.url();
    log.push(`Current URL after submit: ${currentUrl}`);

    // Check for CAPTCHA
    const hasCaptcha =
      (await page.$("iframe[title*='captcha']")) !== null ||
      (await page.$(".captcha-container")) !== null ||
      (await page.$("[data-theme='arkose']")) !== null ||
      currentUrl.includes("checkpoint");

    if (hasCaptcha) {
      log.push("CAPTCHA detected — manual completion required");
      return {
        status: "captcha_required",
        message: "CAPTCHA detected. Please open LinkedIn and complete the registration manually.",
        requiresManual: true,
        manualInstructions: `Open https://www.linkedin.com/signup and register with email: ${ctx.jfEmail}`,
        log,
      };
    }

    // Check for "check your email" confirmation
    const needsVerification =
      currentUrl.includes("email-verification") ||
      currentUrl.includes("check-email") ||
      (await page.$('text="check your email"')) !== null ||
      (await page.$('text="verify your email"')) !== null;

    if (needsVerification || submitted) {
      log.push("Registration form submitted — email verification required");
      return {
        status: "needs_verification",
        message: `Registration submitted. Check ${ctx.jfEmail} for a verification email from LinkedIn.`,
        requiresManual: false,
        log,
      };
    }

    log.push("Unexpected state — form may not have submitted correctly");
    return {
      status: "needs_verification",
      message: `Registration attempted. Check ${ctx.jfEmail} for a verification email from LinkedIn.`,
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
