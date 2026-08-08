import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-home-planning";

mkdirSync(screenshotDirectory, { recursive: true });

test("planning heading stays inside its desktop column", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const section = page.locator(".planning-section");
  await section.scrollIntoViewIfNeeded();

  const title = page.locator("#planning-title");
  const image = page.locator(".planning-card--prices img");
  await expect(title).toBeVisible();
  await expect(image).toBeVisible();

  const layout = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>("#planning-title");
    const cardImage = document.querySelector<HTMLElement>(".planning-card--prices img");
    if (!heading || !cardImage) return null;

    const headingBounds = heading.getBoundingClientRect();
    const imageBounds = cardImage.getBoundingClientRect();
    return {
      internalOverflow: heading.scrollWidth - heading.clientWidth,
      columnGap: imageBounds.left - headingBounds.right,
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.internalOverflow).toBeLessThanOrEqual(0);
  expect(layout!.columnGap).toBeGreaterThanOrEqual(40);

  await section.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
  });
});

test("price card uses the optimized high resolution image", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const image = page.locator(".planning-card--prices img");
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
    .toBe(true);

  const imageDetails = await image.evaluate((element: HTMLImageElement) => ({
    alt: element.alt,
    currentSrc: element.currentSrc,
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight,
    renderedWidth: element.getBoundingClientRect().width,
    renderedHeight: element.getBoundingClientRect().height,
  }));

  expect(imageDetails.alt).toContain("Hochzeitsfotograf Hamburg Preise");
  expect(imageDetails.currentSrc).not.toContain("/images/post-preise.jpg");
  expect(imageDetails.naturalWidth).toBeGreaterThanOrEqual(Math.floor(imageDetails.renderedWidth));
  expect(imageDetails.naturalHeight).toBeGreaterThanOrEqual(Math.floor(imageDetails.renderedHeight));
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow-mobile", width: 320, height: 720 },
]) {
  test(`planning section has no overflow or clipped kickers at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const section = page.locator(".planning-section");
    await section.scrollIntoViewIfNeeded();
    const priceKicker = page.locator(".planning-card--prices .planning-card__kicker");
    await expect(priceKicker).toBeVisible();

    const layout = await page.evaluate(() => {
      const kickers = [
        ...document.querySelectorAll<HTMLElement>(".planning-card__kicker"),
      ];
      const price = document.querySelector<HTMLElement>(
        ".planning-card--prices .planning-card__kicker",
      );

      return {
        pageOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clippedKickers: kickers.filter(
          (kicker) => kicker.scrollWidth > kicker.clientWidth,
        ).length,
        priceFontFamily: price ? getComputedStyle(price).fontFamily : "",
      };
    });

    expect(layout.pageOverflow).toBe(0);
    expect(layout.clippedKickers).toBe(0);
    expect(layout.priceFontFamily).toContain("Raleway");

    await section.screenshot({
      path: `${screenshotDirectory}/${viewport.name}.png`,
    });
  });
}
