import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pageUrl =
  `${baseUrl}/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/`;
const screenshotDirectory = "screenshots/qa-standesamt-altona";
const firstImageAlt =
  "Brautfrisur während der standesamtlichen Trauung im Standesamt Altona";

mkdirSync(screenshotDirectory, { recursive: true });

test("desktop gallery preserves image formats and opens the lightbox", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Standesamtliche Trauung in Hamburg-Altona",
    }),
  ).toBeVisible();
  await expect(page.locator(".gallery-nav")).toBeVisible();

  const gallery = page.getByRole("region", {
    name: "Standesamtliche Trauung im Standesamt Hamburg-Altona",
  });
  await expect(gallery.locator("figure")).toHaveCount(42);

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

  await page.getByRole("button", {
    name: `Bild in Vollansicht öffnen: ${firstImageAlt}`,
  }).click();

  const dialog = page.getByRole("dialog", {
    name: "Hochzeitsreportage Standesamt Altona in Vollansicht",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-gallery-image]")).toHaveAttribute("alt", firstImageAlt);
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

  await page.getByRole("button", {
    name: `Bild in Vollansicht öffnen: ${firstImageAlt}`,
  }).click();

  const previous = page.getByRole("button", { name: "Vorheriges Bild" });
  const next = page.getByRole("button", { name: "Nächstes Bild" });
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await page.waitForTimeout(250);

  for (const control of [previous, next]) {
    const size = await control.evaluate((button) => button.getBoundingClientRect());
    expect(size.width).toBeGreaterThanOrEqual(48);
    expect(size.height).toBeGreaterThanOrEqual(48);
  }

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-lightbox.png`,
    fullPage: false,
  });
});
