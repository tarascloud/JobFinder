import { chromium } from "playwright";
import { type RegistrationContext, type RegistrationResult } from "./types";
import { randomDelay, fillField, safeClick, firstName, lastName } from "./helpers";

/**
 * Auto-register a new Djinni account using the JF email.
 * Registration URL: https://djinni.co/signup/
 *
 * Djinni is a Ukrainian job board; no phone verification required.
 */
export async function registerDjinni(
  ctx: RegistrationContext
): Promise<RegistrationResult> {
  const log: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "uk-UA",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    log.push("Opening Djinni signup page…");
    await page.goto("https://djinni.co/signup/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    // Select "candidate" role if present
    const candidateOption = await page.$('a[href*="candidate"]')
      || await page.$('input[value="candidate"]')
      || await page.$('button:has-text("Candidate")')
      || await page.$('button:has-text("Шукач")');
    if (candidateOption) {
      await candidateOption.click();
      log.push("Selected candidate role");
      await randomDelay(800, 1200);
    }

    // Fill first name
    log.push("Filling first name…");
    for (const sel of [
      'input[name="first_name"]',
      '#id_first_name',
      'input[placeholder*="First"]',
      'input[placeholder*="Ім\'я"]',
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
      'input[name="last_name"]',
      '#id_last_name',
      'input[placeholder*="Last"]',
      'input[placeholder*="Прізвище"]',
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
      'input[name="email"]',
      '#id_email',
      'input[type="email"]',
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
      'input[name="password1"]',
      'input[name="password"]',
      '#id_password1',
      'input[type="password"]',
    ]) {
      try {
        await fillField(page, sel, ctx.password, 5000);
        break;
      } catch { /* try next */ }
    }
    await randomDelay(200, 400);

    // Fill password confirmation if present
    const hasConfirmField = await page.$('input[name="password2"]') !== null
      || await page.$('#id_password2') !== null;
    if (hasConfirmField) {
      log.push("Filling password confirmation…");
      for (const sel of ['input[name="password2"]', '#id_password2']) {
        try {
          await fillField(page, sel, ctx.password, 5000);
          break;
        } catch { /* try next */ }
      }
      await randomDelay(200, 400);
    }

    // Submit
    log.push("Submitting registration form…");
    await safeClick(page, 'button[type="submit"]', 5000)
      || await safeClick(page, 'input[type="submit"]', 3000);

    await randomDelay(2500, 3500);

    const finalUrl = page.url();
    log.push(`URL after submit: ${finalUrl}`);

    if (finalUrl.includes("signup") || finalUrl.includes("register")) {
      // Still on registration page — check for error messages
      const errorText = await page.$('.alert-danger, .errorlist, [class*="error"]');
      if (errorText) {
        const text = await errorText.textContent();
        if (text?.includes("already") || text?.includes("існує")) {
          return {
            status: "already_exists",
            message: `An account with ${ctx.jfEmail} already exists on Djinni.`,
            log,
          };
        }
        log.push(`Form error: ${text}`);
        return {
          status: "failed",
          message: `Registration failed: ${text}`,
          log,
        };
      }
    }

    log.push("Registration submitted — email verification required");
    return {
      status: "needs_verification",
      message: `Registration submitted. Check ${ctx.jfEmail} for a verification email from Djinni.`,
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
