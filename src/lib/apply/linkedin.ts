import { chromium, type Page, type Browser } from "playwright";
import { type ApplyContext, type ApplyResult } from "./types";
import { randomDelay, fillField, safeClick, takeScreenshot, matchQaAnswer } from "./helpers";

export async function applyLinkedIn(
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

    // --- Login ---
    log.push("Navigating to LinkedIn login...");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1000, 2000);

    await fillField(page, "#username", credentials.email);
    await randomDelay(500, 1000);
    await fillField(page, "#password", credentials.password);
    await randomDelay(500, 1000);

    await safeClick(page, 'button[type="submit"]');
    log.push("Submitted login form");

    // Wait for login to complete
    try {
      await page.waitForURL("**/feed/**", { timeout: 15000 });
      log.push("Login successful");
    } catch {
      // Check for security challenge or captcha
      const currentUrl = page.url();
      if (currentUrl.includes("checkpoint") || currentUrl.includes("challenge")) {
        screenshotPath = await takeScreenshot(page, "linkedin-security-challenge");
        return {
          success: false,
          screenshotPath,
          log: [...log, "Security challenge detected. Manual intervention required."],
          error: "LinkedIn security challenge — manual login needed",
        };
      }
      // Check for incorrect credentials
      const errorEl = await page.$(".form__label--error");
      if (errorEl) {
        return {
          success: false,
          log: [...log, "Invalid credentials"],
          error: "LinkedIn login failed — invalid credentials",
        };
      }
      // Might have landed on a different page after login
      log.push(`Login redirect to: ${currentUrl}`);
    }

    await randomDelay(2000, 3000);

    // --- Navigate to vacancy ---
    log.push(`Navigating to vacancy: ${ctx.vacancy.url}`);
    await page.goto(ctx.vacancy.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1500, 2500);

    // Check "Already applied"
    const alreadyApplied = await page.$('span:has-text("Applied")');
    if (alreadyApplied) {
      screenshotPath = await takeScreenshot(page, "linkedin-already-applied");
      return {
        success: false,
        screenshotPath,
        log: [...log, "Already applied to this position"],
        error: "Already applied",
      };
    }

    // --- Click Easy Apply ---
    const easyApplyBtn = await page.$(
      'button:has-text("Easy Apply"), button.jobs-apply-button'
    );
    if (!easyApplyBtn) {
      screenshotPath = await takeScreenshot(page, "linkedin-no-easy-apply");
      return {
        success: false,
        screenshotPath,
        log: [...log, "Easy Apply button not found — external application or closed"],
        error: "Easy Apply not available",
      };
    }

    await easyApplyBtn.click();
    log.push("Clicked Easy Apply");
    await randomDelay(1500, 2500);

    // --- Handle multi-step modal ---
    const maxSteps = 10;
    for (let step = 0; step < maxSteps; step++) {
      log.push(`Processing form step ${step + 1}...`);

      // Wait for modal content
      await page.waitForSelector('.jobs-easy-apply-modal, [data-test-modal]', {
        timeout: 10000,
      }).catch(() => null);
      await randomDelay(800, 1200);

      // Fill contact info fields
      await fillContactFields(page, ctx, log);

      // Upload resume if file input exists
      await handleResumeUpload(page, ctx, log);

      // Handle screening questions
      await handleScreeningQuestions(page, ctx, log, newQuestions);

      // Check for Submit vs Next
      const submitBtn = await page.$(
        'button[aria-label="Submit application"], button:has-text("Submit application")'
      );
      if (submitBtn) {
        await submitBtn.click();
        log.push("Clicked Submit application");
        await randomDelay(2000, 3000);

        // Verify submission
        const confirmationEl = await page
          .waitForSelector(
            'h3:has-text("Application sent"), [data-test-modal-close-btn]',
            { timeout: 10000 }
          )
          .catch(() => null);

        if (confirmationEl) {
          log.push("Application submitted successfully!");
          screenshotPath = await takeScreenshot(page, "linkedin-success");
          return {
            success: true,
            screenshotPath,
            newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
            log,
          };
        }

        // Might have validation errors
        const validationError = await page.$('.artdeco-inline-feedback--error');
        if (validationError) {
          const errorText = await validationError.textContent();
          log.push(`Validation error: ${errorText}`);
          screenshotPath = await takeScreenshot(page, "linkedin-validation-error");
          return {
            success: false,
            screenshotPath,
            newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
            log,
            error: `Validation error: ${errorText}`,
          };
        }

        break;
      }

      // Click Next / Review
      const nextBtn = await page.$(
        'button[aria-label="Continue to next step"], button:has-text("Next"), button:has-text("Review")'
      );
      if (nextBtn) {
        await nextBtn.click();
        log.push("Clicked Next");
        await randomDelay(1000, 2000);
      } else {
        log.push("No Next or Submit button found");
        break;
      }
    }

    // Application limit check
    const limitMsg = await page.$('text="application limit"');
    if (limitMsg) {
      screenshotPath = await takeScreenshot(page, "linkedin-limit-reached");
      return {
        success: false,
        screenshotPath,
        log: [...log, "Daily application limit reached"],
        error: "Application limit reached",
      };
    }

    screenshotPath = await takeScreenshot(page, "linkedin-final");
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

async function fillContactFields(
  page: Page,
  ctx: ApplyContext,
  log: string[]
): Promise<void> {
  // Name fields
  const firstNameInput = await page.$('input[name*="firstName"], input[id*="first-name"]');
  if (firstNameInput) {
    const nameParts = ctx.profile.name.split(" ");
    const currentVal = await firstNameInput.inputValue();
    if (!currentVal) {
      await firstNameInput.fill(nameParts[0]);
      log.push("Filled first name");
    }
  }

  const lastNameInput = await page.$('input[name*="lastName"], input[id*="last-name"]');
  if (lastNameInput) {
    const nameParts = ctx.profile.name.split(" ");
    const currentVal = await lastNameInput.inputValue();
    if (!currentVal) {
      await lastNameInput.fill(nameParts.slice(1).join(" ") || nameParts[0]);
      log.push("Filled last name");
    }
  }

  // Email
  const emailInput = await page.$('input[name*="email"], input[type="email"]');
  if (emailInput) {
    const currentVal = await emailInput.inputValue();
    if (!currentVal) {
      await emailInput.fill(ctx.profile.email);
      log.push("Filled email");
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

  // Cover letter textarea
  if (ctx.coverLetter) {
    const coverLetterField = await page.$(
      'textarea[name*="coverLetter"], textarea[label*="cover"], label:has-text("cover letter") + textarea, label:has-text("Cover letter") ~ textarea'
    );
    if (coverLetterField) {
      const currentVal = await coverLetterField.inputValue();
      if (!currentVal) {
        await coverLetterField.fill(ctx.coverLetter);
        log.push("Filled cover letter");
      }
    }
  }

  // Portfolio / Website URL
  if (ctx.profile.portfolioUrls.length > 0) {
    const websiteInput = await page.$(
      'input[name*="website"], input[name*="portfolio"], input[label*="website"]'
    );
    if (websiteInput) {
      const currentVal = await websiteInput.inputValue();
      if (!currentVal) {
        await websiteInput.fill(ctx.profile.portfolioUrls[0]);
        log.push("Filled portfolio URL");
      }
    }
  }
}

async function handleResumeUpload(
  page: Page,
  ctx: ApplyContext,
  log: string[]
): Promise<void> {
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) return;

  // Check if resume is already uploaded (LinkedIn often auto-fills)
  const uploadedDoc = await page.$('.jobs-document-upload-redesign-card__file-name');
  if (uploadedDoc) {
    log.push("Resume already uploaded — using existing");
    return;
  }

  if (ctx.profile.resumeUrl) {
    log.push(`Resume URL provided: ${ctx.profile.resumeUrl} — file upload requires local file path`);
    // Note: For URL-based resumes, the executor should download first and pass a local path.
    // This is handled at the apply-executor level.
  }
}

async function handleScreeningQuestions(
  page: Page,
  ctx: ApplyContext,
  log: string[],
  newQuestions: string[]
): Promise<void> {
  // Find all question groups in the form
  const questionGroups = await page.$$(
    '.jobs-easy-apply-form-section__grouping, [data-test-form-element]'
  );

  for (const group of questionGroups) {
    // Find the label/question text
    const labelEl = await group.$('label, .fb-dash-form-element__label, span.t-14');
    if (!labelEl) continue;

    const questionText = (await labelEl.textContent())?.trim();
    if (!questionText) continue;

    // Skip standard contact fields
    const skipPatterns = /^(first name|last name|email|phone|mobile|resume|cv)/i;
    if (skipPatterns.test(questionText)) continue;

    // Check for text input
    const textInput = await group.$('input[type="text"], textarea');
    if (textInput) {
      const currentVal = await textInput.inputValue();
      if (currentVal) continue; // Already filled

      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        await textInput.fill(answer);
        log.push(`Answered "${questionText}" from Q&A base`);
      } else {
        newQuestions.push(questionText);
        log.push(`New question (no answer): "${questionText}"`);
      }
      continue;
    }

    // Check for select dropdown
    const selectEl = await group.$('select');
    if (selectEl) {
      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        // Try to find option matching the answer
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
          log.push(`Could not match dropdown option for "${questionText}"`);
        }
      } else {
        newQuestions.push(questionText);
        log.push(`New question (dropdown, no answer): "${questionText}"`);
      }
      continue;
    }

    // Check for radio buttons
    const radioButtons = await group.$$('input[type="radio"]');
    if (radioButtons.length > 0) {
      const answer = matchQaAnswer(questionText, ctx.qaAnswers);
      if (answer) {
        let matched = false;
        for (const radio of radioButtons) {
          const radioLabel = await radio.evaluate(
            (el) => el.closest("label")?.textContent?.trim() ?? ""
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
          log.push(`Could not match radio option for "${questionText}"`);
        }
      } else {
        newQuestions.push(questionText);
        log.push(`New question (radio, no answer): "${questionText}"`);
      }
    }
  }
}
