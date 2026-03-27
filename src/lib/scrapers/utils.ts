/**
 * Shared scraper utilities.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Simple promise-based delay.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if `title` contains at least one of the `jobTitles`
 * (case-insensitive). Returns true for an empty array.
 */
export function matchesTitle(title: string, jobTitles: string[]): boolean {
  if (jobTitles.length === 0) return true;
  const lower = title.toLowerCase();
  return jobTitles.some((search) => lower.includes(search.toLowerCase()));
}

/**
 * fetch() wrapper that aborts after `timeoutMs` milliseconds.
 * Drop-in replacement: same signature as global fetch, plus an optional
 * `timeoutMs` parameter (defaults to 30 s).
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Fetch timed out after ${timeoutMs}ms: ${typeof input === "string" ? input : String(input)}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
