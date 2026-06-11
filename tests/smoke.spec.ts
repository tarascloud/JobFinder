import { test, expect } from "@playwright/test";

test("health endpoint returns 200", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.status).toBe("ok");
});

// Browser-level smoke (read-only, no auth): catches CSP violations and
// hydration failures that curl/healthchecks miss (see .claude/rules/deploy-smoke.md).
test("login page renders without CSP/hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/login");
  await expect(page.locator("button").first()).toBeVisible();

  const cspErrors = errors.filter((e) =>
    /Content Security Policy|Hydration failed|did not match/i.test(e),
  );
  expect(
    cspErrors,
    `CSP/hydration errors found:\n${cspErrors.join("\n")}`,
  ).toHaveLength(0);
});
