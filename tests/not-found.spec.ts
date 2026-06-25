import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-404";

const waitForArtwork = async (page: import("@playwright/test").Page) => {
  await expect
    .poll(() =>
      page.locator(".error-artwork img").evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
};

test("404 page presents the museum scene and useful navigation on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto(`${baseUrl}/diese-seite-gibt-es-nicht/`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", {
    name: "Diese Seite hat sich wohl im Museum verlaufen.",
  })).toBeVisible();
  await expect(page.getByRole("img", {
    name: "Fotograf York Augustin betrachtet in einem Museum ein zeitgenössisches Gemälde mit der Aufschrift 404 Not Found",
  })).toBeVisible();
  await waitForArtwork(page);
  await expect(page.getByRole("link", { name: "Zur Startseite" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/404-desktop.png`,
    fullPage: true,
  });
});

test("404 page remains readable and complete on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${baseUrl}/diese-seite-gibt-es-nicht/`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
  await waitForArtwork(page);

  const artwork = page.locator(".error-artwork img");
  const artworkBox = await artwork.boundingBox();
  expect(artworkBox?.width).toBe(390);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/404-mobile.png`,
    fullPage: true,
  });
});
