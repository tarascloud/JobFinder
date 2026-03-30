import { randomBytes } from "crypto";
import { type Page } from "playwright";

/**
 * Generate a secure random password for platform registration.
 * Format: 16 chars, mix of upper/lower/digits/special.
 */
export function generatePassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * Human-like typing delay.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Fill a field with slow human-like typing.
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string,
  timeoutMs = 8000
): Promise<void> {
  const el = await page.waitForSelector(selector, { timeout: timeoutMs });
  if (!el) throw new Error(`Field not found: ${selector}`);
  await el.click();
  await randomDelay(100, 300);
  await el.fill(value);
}

/**
 * Try clicking a selector. Returns false if not found within timeout.
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
 * Extract first name from full name, falls back to "User".
 */
export function firstName(name: string | null | undefined): string {
  if (!name) return "User";
  return name.trim().split(/\s+/)[0] || "User";
}

/**
 * Extract last name from full name, falls back to "Jobseeker".
 */
export function lastName(name: string | null | undefined): string {
  if (!name) return "Jobseeker";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1] : "Jobseeker";
}
