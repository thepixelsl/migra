import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-home-mobile";

test("mobile homepage uses the editorial header and larger image slider", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const navigationBar = page.locator(".mobile-navigation__bar");
  const slider = page.locator(".hero-slider--mobile");

  await expect(navigationBar).toBeVisible();
  await expect(slider).toBeVisible();
  await expect(page.locator(".booking-strip")).toBeHidden();
  expect(await slider.locator(".hero-slider__slide img[src]").count()).toBeGreaterThanOrEqual(3);

  const navigationBox = await navigationBar.boundingBox();
  const sliderBox = await slider.boundingBox();

  expect(navigationBox?.height).toBeGreaterThanOrEqual(140);
  expect(sliderBox?.height).toBeGreaterThanOrEqual(230);
  expect(sliderBox?.width).toBe(390);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile-home-hero.png`,
    fullPage: false,
  });
});
