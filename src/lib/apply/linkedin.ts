import { chromium, type Page, type Browser, type BrowserContext } from "playwright";
import { type ApplyContext, type ApplyResult } from "./types";
import { randomDelay, fillField, safeClick, takeScreenshot, matchQaAnswer } from "./helpers";
import { matchQuestion, type MatchResult } from "@/lib/ai/qa-matcher";
import { prisma } from "@/lib/db";
import { encrypt, decryptGraceful } from "@/lib/encryption";

/**
 * Load saved session cookies from PlatformAccount.sessionData.
 * Returns parsed cookies or null if none saved / decryption fails.
 */
async function loadSessionCookies(
  platformAccountId: number
): Promise<Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}> | null> {
  try {
    const account = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
      select: { sessionData: true },
    });
    if (!account?.sessionData) return null;

    const decrypted = decryptGraceful(account.sessionData);
    const cookies = JSON.parse(decrypted);
    if (!Array.isArray(cookies) || cookies.length === 0) return null;

    // Filter out expired cookies
    const now = Date.now() / 1000;
    const valid = cookies.filter(
      (c: { expires?: number }) => !c.expires || c.expires === -1 || c.expires > now
    );
    return valid.length > 0 ? valid : null;
  } catch (err) {
    console.error("[linkedin] Failed to load session cookies:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Save browser cookies to PlatformAccount.sessionData (encrypted).
 */
async function saveSessionCookies(
  platformAccountId: number,
  context: BrowserContext
): Promise<void> {
  try {
    const cookies = await context.cookies();
    // Only save LinkedIn cookies
    const linkedinCookies = cookies.filter((c) =>
      c.domain.includes("linkedin.com")
    );
    if (linkedinCookies.length === 0) return;

    const encrypted = encrypt(JSON.stringify(linkedinCookies));
    await prisma.platformAccount.update({
      where: { id: platformAccountId },
      data: {
        sessionData: encrypted,
        lastLogin: new Date(),
      },
    });
  } catch (err) {
    console.error("[linkedin] Failed to save session cookies:", err instanceof Error ? err.message : err);
  }
}

export async function applyLinkedIn(
  ctx: ApplyContext,
  credentials: { email: string; password: string }
): Promise<ApplyResult> {
  const log: string[] = [];
  const newQuestions: string[] = [];
  const suggestedAnswers: { question: string; answer: string; confidence: number }[] = [];
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

    // --- Session cookie reuse ---
    let loggedInViaCookies = false;
    const savedCookies = await loadSessionCookies(ctx.platformAccountId);
    if (savedCookies) {
      log.push(`Loading ${savedCookies.length} saved session cookies...`);
      await context.addCookies(savedCookies);

      // Try navigating directly to feed to check if session is valid
      const page = await context.newPage();
      try {
        await page.goto("https://www.linkedin.com/feed/", {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await randomDelay(1000, 2000);

        const currentUrl = page.url();
        if (currentUrl.includes("/feed") || currentUrl.includes("/mynetwork") || currentUrl.includes("/in/")) {
          log.push("Session cookies valid — skipping login");
          loggedInViaCookies = true;
        } else {
          log.push("Session cookies expired — falling back to password login");
          await page.close();
        }
      } catch {
        log.push("Session cookie check failed — falling back to password login");
        await page.close();
      }
    }

    const page = loggedInViaCookies
      ? context.pages()[0]
      : await context.newPage();

    if (!loggedInViaCookies) {
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

        // Save cookies after successful login
        await saveSessionCookies(ctx.platformAccountId, context);
        log.push("Session cookies saved for reuse");
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

      // Handle screening questions (with AI matching)
      const screeningResult = await handleScreeningQuestions(page, ctx, log, newQuestions, suggestedAnswers);

      // If unanswered questions found, pause and return early
      if (screeningResult.shouldPause) {
        log.push(`Pausing — ${screeningResult.newQuestions.length} unanswered question(s) found`);
        screenshotPath = await takeScreenshot(page, "linkedin-paused-qa");
        return {
          success: false,
          paused: true,
          screenshotPath,
          newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
          suggestedAnswers: suggestedAnswers.length > 0 ? suggestedAnswers : undefined,
          log,
        };
      }

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
          // Save cookies after successful application
          await saveSessionCookies(ctx.platformAccountId, context);
          return {
            success: true,
            screenshotPath,
            newQuestions: newQuestions.length > 0 ? newQuestions : undefined,
            suggestedAnswers: suggestedAnswers.length > 0 ? suggestedAnswers : undefined,
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
            suggestedAnswers: suggestedAnswers.length > 0 ? suggestedAnswers : undefined,
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
      suggestedAnswers: suggestedAnswers.length > 0 ? suggestedAnswers : undefined,
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
      suggestedAnswers: suggestedAnswers.length > 0 ? suggestedAnswers : undefined,
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

/**
 * Try to find an answer for a screening question:
 * 1. Exact/substring match from Q&A base
 * 2. If no match, AI semantic matching with confidence tiers
 *
 * Returns { answer, source } or null if no answer found.
 */
async function findAnswer(
  questionText: string,
  ctx: ApplyContext,
  log: string[],
  suggestedAnswers: { question: string; answer: string; confidence: number }[]
): Promise<{ answer: string; source: "qa_exact" | "ai_auto" } | null> {
  // Step 1: exact / substring match
  const exactAnswer = matchQaAnswer(questionText, ctx.qaAnswers);
  if (exactAnswer) {
    return { answer: exactAnswer, source: "qa_exact" };
  }

  // Step 2: AI semantic match
  const qaPairs = Array.from(ctx.qaAnswers.entries()).map(([q, a]) => ({
    question: q,
    answer: a,
  }));

  if (qaPairs.length === 0) return null;

  const aiResult: MatchResult = await matchQuestion(questionText, qaPairs, ctx.userId);

  if (aiResult.tier === "auto" && aiResult.answer) {
    log.push(
      `AI auto-matched "${questionText}" (confidence: ${aiResult.confidence.toFixed(2)})`
    );
    return { answer: aiResult.answer, source: "ai_auto" };
  }

  if (aiResult.tier === "suggested" && aiResult.answer) {
    log.push(
      `AI suggested answer for "${questionText}" (confidence: ${aiResult.confidence.toFixed(2)}) — needs review`
    );
    suggestedAnswers.push({
      question: questionText,
      answer: aiResult.answer,
      confidence: aiResult.confidence,
    });
    // Still return null — we want to pause for review
    return null;
  }

  if (aiResult.confidence > 0) {
    log.push(
      `AI could not match "${questionText}" (confidence: ${aiResult.confidence.toFixed(2)})`
    );
  }

  return null;
}

async function handleScreeningQuestions(
  page: Page,
  ctx: ApplyContext,
  log: string[],
  newQuestions: string[],
  suggestedAnswers: { question: string; answer: string; confidence: number }[]
): Promise<{ shouldPause: boolean; newQuestions: string[] }> {
  let shouldPause = false;
  const stepNewQuestions: string[] = [];
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

      const result = await findAnswer(questionText, ctx, log, suggestedAnswers);
      if (result) {
        await textInput.fill(result.answer);
        log.push(`Answered "${questionText}" from ${result.source === "ai_auto" ? "AI match" : "Q&A base"}`);
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (no answer): "${questionText}"`);
      }
      continue;
    }

    // Check for select dropdown
    const selectEl = await group.$('select');
    if (selectEl) {
      const result = await findAnswer(questionText, ctx, log, suggestedAnswers);
      if (result) {
        // Try to find option matching the answer
        const options = await selectEl.$$('option');
        let matched = false;
        for (const opt of options) {
          const optText = (await opt.textContent())?.trim().toLowerCase();
          if (optText && result.answer.toLowerCase().includes(optText)) {
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
          log.push(`Could not match dropdown option for "${questionText}"`);
        }
      } else {
        newQuestions.push(questionText);
        stepNewQuestions.push(questionText);
        shouldPause = true;
        log.push(`New question (dropdown, no answer): "${questionText}"`);
      }
      continue;
    }

    // Check for radio buttons
    const radioButtons = await group.$$('input[type="radio"]');
    if (radioButtons.length > 0) {
      const result = await findAnswer(questionText, ctx, log, suggestedAnswers);
      if (result) {
        let matched = false;
        for (const radio of radioButtons) {
          const radioLabel = await radio.evaluate(
            (el) => el.closest("label")?.textContent?.trim() ?? ""
          );
          if (radioLabel.toLowerCase().includes(result.answer.toLowerCase())) {
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
          log.push(`Could not match radio option for "${questionText}"`);
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
