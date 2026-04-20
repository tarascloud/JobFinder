import { test, expect } from "@playwright/test";

test("health endpoint returns 200", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.status).toBe("ok");
});
