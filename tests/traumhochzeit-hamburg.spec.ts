import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/gallery/traumhochzeit-in-hamburg/";
const screenshotDirectory = "screenshots/qa-traumhochzeit-hamburg";

test("desktop gallery preserves the Atlantic wedding image formats", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Traumhochzeit in Hamburg" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid__item")).toHaveCount(28);

  const ratios = await page.locator(".gallery-image-grid__item img").evaluateAll((images) =>
    images.map((image: HTMLImageElement) =>
      Number(image.getAttribute("width")) / Number(image.getAttribute("height")),
    ),
  );
  expect(ratios.some((ratio) => ratio > 1.4)).toBe(true);
  expect(ratios.some((ratio) => ratio < 0.8)).toBe(true);
  expect(ratios.some((ratio) => ratio > 0.95 && ratio < 1.05)).toBe(true);

  const firstTrigger = page.locator("[data-gallery-trigger='traumhochzeit-hamburg']");
  expect(await firstTrigger.count()).toBe(28);
  await firstTrigger.first().click();

  const dialog = page.getByRole("dialog", { name: "Traumhochzeit in Hamburg in Vollansicht" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Vorheriges Bild" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nächstes Bild" })).toBeVisible();

  await page.getByRole("button", { name: "Vollansicht schließen" }).last().click();
  await expect(dialog).toBeHidden();

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: false,
  });
});

test("mobile Atlantic gallery is touch friendly and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid")).toHaveCSS("grid-template-columns", "366px");

  const triggerHeights = await page
    .locator("[data-gallery-trigger='traumhochzeit-hamburg']")
    .evaluateAll((buttons) => buttons.slice(0, 4).map((button) => button.getBoundingClientRect().height));
  expect(Math.min(...triggerHeights)).toBeGreaterThan(44);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
