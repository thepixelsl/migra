import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-pricing-page";

mkdirSync(screenshotDirectory, { recursive: true });

test("pricing page renders with local links and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toContainText("Hochzeitsfotograf Hamburg Preise");
  await expect(page.locator("#pakete")).toBeVisible();
  await expect(page.locator("#faq")).toBeVisible();
  await expect(page.locator("text=Pure Moments")).toBeVisible();
  await expect(page.locator("text=Standesamt Paket")).toBeVisible();
  await expect(page.locator("text=Rundum-Sorglos-Paket")).toBeVisible();

  const oldPriceLinks = await page.locator('a[href="https://artbild-fotografie.de/hochzeitsfotograf-preise/"]').count();
  expect(oldPriceLinks).toBe(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: false,
  });
});

test("pricing page is usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".pricing-hero__actions a").first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
