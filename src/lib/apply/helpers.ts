import { type Page } from "playwright";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const SCREENSHOTS_DIR = join(process.cwd(), "public", "screenshots");

/**
 * Random delay between min and max milliseconds to mimic human behavior.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Fill a form field with realistic typing delay.
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const el = await page.waitForSelector(selector, { timeout: 5000 });
  if (!el) throw new Error(`Field not found: ${selector}`);

  await el.click();
  await randomDelay(100, 300);
  await el.fill(value);
}

/**
 * Click a button/element safely with retry.
 */
export async function safeClick(
  page: Page,
  selector: string,
  timeoutMs = 5000
): Promise<boolean> {
  try {
    const el = await page.waitForSelector(selector, { timeout: timeoutMs });
    if (!el) return false;
    await el.click();
    return true;
  } catch {
    return false;
  }
}

/**
 * Take a screenshot and save it to the screenshots directory.
 * Returns the relative path from public/ for serving.
 */
export async function takeScreenshot(
  page: Page,
  prefix: string
): Promise<string> {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${prefix}-${timestamp}.png`;
  const fullPath = join(SCREENSHOTS_DIR, filename);

  await page.screenshot({ path: fullPath, fullPage: false });

  return `/screenshots/${filename}`;
}

/**
 * Match a screening question against the Q&A answers map.
 * Does case-insensitive substring matching on the question text.
 */
export function matchQaAnswer(
  question: string,
  qaAnswers: Map<string, string>
): string | undefined {
  const normalizedQuestion = question.toLowerCase().trim();

  // Exact match first
  for (const [q, a] of qaAnswers) {
    if (q.toLowerCase().trim() === normalizedQuestion) {
      return a;
    }
  }

  // Substring containment match
  for (const [q, a] of qaAnswers) {
    const normalizedKey = q.toLowerCase().trim();
    if (
      normalizedQuestion.includes(normalizedKey) ||
      normalizedKey.includes(normalizedQuestion)
    ) {
      return a;
    }
  }

  return undefined;
}
