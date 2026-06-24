import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pageUrl = `${baseUrl}/gallery/hochzeitsfotos-hamburg/`;
const screenshotDirectory = "screenshots/qa-hochzeitsfotos-hamburg";

mkdirSync(screenshotDirectory, { recursive: true });

test("desktop gallery preserves image formats and opens the lightbox", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Hochzeitsfotos Hamburg" })).toBeVisible();
  await expect(page.locator(".gallery-nav")).toBeVisible();

  const gallery = page.getByRole("region", {
    name: "Hochzeitsfotos aus den Fraser Suites Hamburg",
  });
  await expect(gallery.locator("figure")).toHaveCount(29);

  const firstImage = gallery.locator("img").first();
  await expect(firstImage).toBeVisible();
  const ratios = await firstImage.evaluate((image) => {
    const element = image as HTMLImageElement;
    const bounds = element.getBoundingClientRect();
    return {
      natural: element.naturalWidth / element.naturalHeight,
      rendered: bounds.width / bounds.height,
    };
  });
  expect(Math.abs(ratios.natural - ratios.rendered)).toBeLessThan(0.02);

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-hero.png`,
    fullPage: false,
  });

  const firstTrigger = page.getByRole("button", {
    name: "Bild in Vollansicht öffnen: Brautportrait in den Fraser Suites Hamburg",
  });
  await firstTrigger.click();

  const dialog = page.getByRole("dialog", { name: "Hochzeitsfotos Hamburg in Vollansicht" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-gallery-image]")).toHaveAttribute(
    "alt",
    "Brautportrait in den Fraser Suites Hamburg",
  );
  await page.waitForTimeout(250);

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-lightbox.png`,
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("mobile gallery is touch friendly and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  const firstTrigger = page.getByRole("button", {
    name: "Bild in Vollansicht öffnen: Brautportrait in den Fraser Suites Hamburg",
  });
  await firstTrigger.click();

  const previous = page.getByRole("button", { name: "Vorheriges Bild" });
  const next = page.getByRole("button", { name: "Nächstes Bild" });
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await page.waitForTimeout(250);

  const nextSize = await next.evaluate((button) => button.getBoundingClientRect());
  expect(nextSize.width).toBeGreaterThanOrEqual(48);
  expect(nextSize.height).toBeGreaterThanOrEqual(48);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-lightbox.png`,
    fullPage: false,
  });
});
