import { chromium, type Page, type Browser } from "playwright";
import { type ApplyContext, type ApplyResult } from "./types";
import { randomDelay, fillField, safeClick, takeScreenshot, matchQaAnswer } from "./helpers";

export async function applyIndeed(
  ctx: ApplyContext,
  credentials: { email: string; password: string }
): Promise<ApplyResult> {
  const log: string[] = [];
  const newQuestions: string[] = [];
  let browser: Browser | null = null;
  let screenshotPath: string | undefined;

  try {
    log.push("Launching browser...");
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    const page = await context.newPage();

    // --- Login ---
    log.push("Navigating to Indeed login...");
    await page.goto("https://secure.indeed.com/auth", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1500, 2500);

    // Indeed login flow: enter email first, then password
    const emailInput = await page.$('input[type="email"], input[name="__email"]');
    if (emailInput) {
      await fillField(page, 'input[type="email"], input[name="__email"]', credentials.email);
      await randomDelay(500, 1000);

      // Click continue/next for email step
      await safeClick(page, 'button[type="submit"], button:has-text("Continue")');
      log.push("Submitted email");
      await randomDelay(2000, 3000);
    }

    // Password step
    const passwordInput = await page.waitForSelector(
      'input[type="password"], input[name="__password"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (passwordInput) {
      await passwordInput.fill(credentials.password);
      await randomDelay(500, 1000);
      await safeClick(page, 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
      log.push("Submitted password");
      await randomDelay(2000, 3000);
    }

    // Check for captcha or verification
    const captcha = await page.$('[id*="captcha"], [class*="captcha"]');
    if (captcha) {
      screenshotPath = await takeScreenshot(page, "indeed-captcha");
      return {
        success: false,
        screenshotPath,
        log: [...log, "CAPTCHA detected. Manual intervention required."],
        error: "Indeed CAPTCHA — manual login needed",
      };
    }

    // Verify login by checking for user menu or redirect
    const loggedIn = await page
      .waitForSelector('[data-gnav-element-name="AccountMenu"], [data-testid="gnav-header-account"]', {
        timeout: 10000,
      })
      .catch(() => null);

    if (!loggedIn) {
      const currentUrl = page.url();
      if (currentUrl.includes("auth")) {
        screenshotPath = await takeScreenshot(page, "indeed-login-failed");
        return {
          success: false,
          screenshotPath,
          log: [...log, "Login may have failed — still on auth page"],
          error: "Indeed login failed",
        };
      }
    }
    log.push("Login successful");

    await randomDelay(1500, 2500);

    // --- Navigate to vacancy ---
    log.push(`Navigating to vacancy: ${ctx.vacancy.url}`);
    await page.goto(ctx.vacancy.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(2000, 3000);

    // Check if already applied
    const alreadyApplied = await page.$(
      'span:has-text("Applied"), [data-testid="applied-snippet"]'
    );
    if (alreadyApplied) {
      screenshotPath = await takeScreenshot(page, "indeed-already-applied");
      return {
        success: false,
        screenshotPath,
        log: [...log, "Already applied to this position"],
        error: "Already applied",
      };
    }

    // --- Click Apply Now ---
    const applyBtn = await page.$(
      'button:has-text("Apply now"), button[id="indeedApplyButton"], a:has-text("Apply now")'
    );
    if (!applyBtn) {
      screenshotPath = await takeScreenshot(page, "indeed-no-apply");
      return {
        success: false,
        screenshotPath,
        log: [...log, "Apply button not found — may be external application"],
        error: "Apply button not available",
      };
    }

    await applyBtn.click();
    log.push("Clicked Apply Now");
    await randomDelay(2000, 3000);

    // --- Handle multi-step application form ---
    const maxSteps = 12;
    for (let step = 0; step < maxSteps; step++) {
      log.push(`Processing form step ${step + 1}...`);
      await randomDelay(1000, 1500);

      // Fill contact info
      await fillIndeedContactFields(page, ctx, log);

      // Handle resume
      await handleIndeedResume(page, ctx, log);

      // Handle screening questions
      const screeningResult = await handleIndeedQuestions(page, ctx, log, newQuestions);

      // If unanswered questions found, pause and return early
      if (screeningResult.shouldPause) {
        log.push(`Pausing — ${screeningResult.newQuestions.length} unanswered question(s) found`);
        screenshotPath = await takeScreenshot(page, "indeed-paused-qa");
        return {
          success: false,
          paused: true,
          screenshotPath,
          newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
          log,
        };
      }

      // Check for Submit
      const submitBtn = await page.$(
        'button:has-text("Submit your application"), button:has-text("Submit"), button[data-testid="submit-button"]'
      );
      if (submitBtn) {
        await submitBtn.click();
        log.push("Clicked Submit");
        await randomDelay(2000, 3000);

        // Check confirmation
        const confirmation = await page
          .waitForSelector(
            'h1:has-text("Application submitted"), [data-testid="post-apply"]',
            { timeout: 10000 }
          )
          .catch(() => null);

        if (confirmation) {
          log.push("Application submitted successfully!");
          screenshotPath = await takeScreenshot(page, "indeed-success");
          return {
            success: true,
            screenshotPath,
            newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
            log,
          };
        }

        // Check for errors
        const errorEl = await page.$('[class*="error"], [data-testid*="error"]');
        if (errorEl) {
          const errorText = await errorEl.textContent();
          log.push(`Form error: ${errorText}`);
          screenshotPath = await takeScreenshot(page, "indeed-form-error");
          return {
            success: false,
            screenshotPath,
            newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
            log,
            error: `Form error: ${errorText}`,
          };
        }

        break;
      }

      // Click Continue/Next
      const nextBtn = await page.$(
        'button:has-text("Continue"), button:has-text("Next"), button[data-testid="continue-button"]'
      );
      if (nextBtn) {
        await nextBtn.click();
        log.push("Clicked Continue/Next");
        await randomDelay(1500, 2500);
      } else {
        log.push("No Continue or Submit button found on this step");
        break;
      }
    }

    screenshotPath = await takeScreenshot(page, "indeed-final");
    return {
      success: false,
      screenshotPath,
      newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
      log: [...log, "Could not confirm submission — review screenshot"],
      error: "Submission could not be confirmed",
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    log.push(`Error: ${errorMsg}`);
    return {
      success: false,
      screenshotPath,
      newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
      log,
      error: errorMsg,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function fillIndeedContactFields(
  page: Page,
  ctx: ApplyContext,
  log: string[]
): Promise<void> {
  // Name
  const nameInput = await page.$('input[name*="name"], input[id*="input-name"]');
  if (nameInput) {
    const currentVal = await nameInput.inputValue();
    if (!currentVal) {
      await nameInput.fill(ctx.profile.name);
      log.push("Filled name");
    }
  }

  // Email — use per-user apply email for tracking recruiter replies
  const emailInput = await page.$('input[name*="email"], input[type="email"]');
  if (emailInput) {
    const currentVal = await emailInput.inputValue();
    if (!currentVal) {
      await emailInput.fill(ctx.profile.applyEmail);
      log.push(`Filled email with apply address: ${ctx.profile.applyEmail}`);
    }
  }

  // Phone
  if (ctx.profile.phone) {
    const phoneInput = await page.$('input[name*="phone"], input[type="tel"]');
    if (phoneInput) {
      const currentVal = await phoneInput.inputValue();
      if (!currentVal) {
        await phoneInput.fill(ctx.profile.phone);
        log.push("Filled phone number");
      }
    }
  }

  // Cover letter
  if (ctx.coverLetter) {
    const coverField = await page.$(
      'textarea[name*="coverletter"], textarea[id*="cover-letter"], textarea[data-testid*="cover-letter"]'
    );
    if (coverField) {
      const currentVal = await coverField.inputValue();
      if (!currentVal) {
        await coverField.fill(ctx.coverLetter);
        log.push("Filled cover letter");
      }
    }
  }
}

async function handleIndeedResume(
  page: Page,
  ctx: ApplyContext,
  log: string[]
): Promise<void> {
  // Check for existing resume selection
  const existingResume = await page.$(
    '[data-testid="resume-display-text"], .ia-Resume-display'
  );
  if (existingResume) {
    log.push("Using existing Indeed resume");
    return;
  }

  // File upload input
  const fileInput = await page.$('input[type="file"]');
  if (fileInput && ctx.profile.resumeUrl) {
    log.push(`Resume URL: ${ctx.profile.resumeUrl} — file upload requires local path`);
  }
}

async function handleIndeedQuestions(
  page: Page,
  ctx: ApplyContext,
  log: string[],
  newQuestions: string[]
): Promise<{ shouldPause: boolean; newQuestions: string[] }> {
  let shouldPause = false;
  const stepNewQuestions: string[] = [];

  // Indeed wraps questions in fieldset or div groups
  const questionGroups = await page.$$(
    'fieldset, [data-testid="question-container"], .ia-Questions-item'
  );

  for (const group of questionGroups) {
    const legendEl = await group.$(
      'legend, label, [data-testid="question-label"], .ia-Questions-questionWrapper'
    );
    if (!legendEl) continue;

    const questionText = (await legendEl.textContent())?.trim();
    if (!questionText) continue;

    // Skip standard fields
    const skipPatterns = /^(your name|full name|email|phone|resume|cover letter)/i;
    if (skipPatterns.test(questionText)) continue;

    // Text input
    const textInput = await group.$('input[type="text"], textarea');
    if (textInput) {
      const currentVal = await textInput.inputValue();
      if (currentVal) continue;

      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        await textInput.fill(answer);
        log.push(`Answered "${questionText}" from Q&A base`);
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (no answer): "${questionText}"`);
      }
      continue;
    }

    // Number input (years of experience, etc.)
    const numInput = await group.$('input[type="number"]');
    if (numInput) {
      const currentVal = await numInput.inputValue();
      if (currentVal) continue;

      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        const numMatch = answer.match(/\d+/);
        if (numMatch) {
          await numInput.fill(numMatch[0]);
          log.push(`Answered number "${numMatch[0]}" for "${questionText}"`);
        }
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (number, no answer): "${questionText}"`);
      }
      continue;
    }

    // Select dropdown
    const selectEl = await group.$('select');
    if (selectEl) {
      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        const options = await selectEl.$$('option');
        let matched = false;
        for (const opt of options) {
          const optText = (await opt.textContent())?.trim().toLowerCase();
          if (optText && answer.toLowerCase().includes(optText)) {
            const optValue = await opt.getAttribute("value");
            if (optValue) {
              await selectEl.selectOption(optValue);
              log.push(`Selected "${optText}" for "${questionText}"`);
              matched = true;
              break;
            }
          }
        }
        if (!matched) {
          newQuestions.push(questionText);
          stepNewQuestions.push(questionText);
          shouldPause = true;
        }
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (dropdown, no answer): "${questionText}"`);
      }
      continue;
    }

    // Radio buttons
    const radioButtons = await group.$$('input[type="radio"]');
    if (radioButtons.length > 0) {
      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        let matched = false;
        for (const radio of radioButtons) {
          const radioLabel = await radio.evaluate(
            (el) =>
              el.closest("label")?.textContent?.trim() ??
              el.parentElement?.textContent?.trim() ??
              ""
          );
          if (radioLabel.toLowerCase().includes(answer.toLowerCase())) {
            await radio.check();
            log.push(`Selected radio "${radioLabel}" for "${questionText}"`);
            matched = true;
            break;
          }
        }
        if (!matched) {
          newQuestions.push(questionText);
          stepNewQuestions.push(questionText);
          shouldPause = true;
        }
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (radio, no answer): "${questionText}"`);
      }
    }
  }

  return { shouldPause, newQuestions: stepNewQuestions };
}
