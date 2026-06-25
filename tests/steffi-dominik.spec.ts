import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/gallery/steffi-dominik/";
const screenshotDirectory = "screenshots/qa-steffi-dominik";

test("desktop gallery preserves the wedding report formats and lightbox", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Steffi & Dominik" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid__item")).toHaveCount(24);

  const ratios = await page.locator(".gallery-image-grid__item img").evaluateAll((images) =>
    images.map((image: HTMLImageElement) =>
      Number(image.getAttribute("width")) / Number(image.getAttribute("height")),
    ),
  );
  expect(ratios.some((ratio) => ratio > 1.35)).toBe(true);
  expect(ratios.some((ratio) => ratio < 0.8)).toBe(true);

  const triggers = page.locator("[data-gallery-trigger='steffi-dominik']");
  expect(await triggers.count()).toBe(24);
  await triggers.first().click();

  const dialog = page.getByRole("dialog", {
    name: "Hochzeit von Steffi und Dominik in Vollansicht",
  });
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

test("mobile gallery remains readable and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid")).toHaveCSS("grid-template-columns", "366px");

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
