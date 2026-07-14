import { expect, test } from "@playwright/test";

test("the app renders a useful surface without an uncaught browser error", async ({ page }) => {
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));

  await page.goto("/");
  await page.waitForTimeout(250);
  expect(uncaught).toEqual([]);
  await expect(page.locator("main")).toBeVisible();
});
