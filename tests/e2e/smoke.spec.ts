import { expect, test } from "@playwright/test";

test("the app renders a useful surface without an uncaught browser error", async ({ page }) => {
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));

  await page.goto("/");
  await page.waitForTimeout(250);
  expect(uncaught).toEqual([]);
  await expect(page.locator("main")).toBeVisible();
});

test("the configured public landing page exposes its primary actions", async ({ page }) => {
  test.skip(!process.env.VITE_CLERK_PUBLISHABLE_KEY || !process.env.VITE_CONVEX_URL);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /consumer research in days, not weeks/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /join the waitlist/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});

test("a participant must consent before choosing an interview mode", async ({ page }) => {
  await page.goto("/interview/demo");
  await expect(page.getByRole("heading", { name: /consent to take part/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /choose how you want to answer/i })).toHaveCount(0);

  await page.getByRole("button", { name: /agree and want to continue/i }).click();
  await expect(page.getByRole("heading", { name: /choose how you want to answer/i })).toBeVisible();
});
