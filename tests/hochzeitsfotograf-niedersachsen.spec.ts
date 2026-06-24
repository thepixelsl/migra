import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pageUrl = `${baseUrl}/gallery/hochzeitsfotograf-niedersachsen/`;
const screenshotDirectory = "screenshots/qa-hochzeitsfotograf-niedersachsen";
const firstImageAlt =
  "Herzdekoration im Grünen bei einer Hochzeit in Niedersachsen";
const portraitImageAlt =
  "Brautkleid und Brautschuhe beim Getting Ready in Lauenbrück";

mkdirSync(screenshotDirectory, { recursive: true });

test("desktop report preserves landscape and portrait formats", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Hochzeitsfotograf Niedersachsen",
    }),
  ).toBeVisible();
  await expect(page.locator(".gallery-nav")).toBeVisible();

  const gallery = page.getByRole("region", {
    name: "Hochzeitsreportage von Kathrin und Sven in Niedersachsen",
  });
  await expect(gallery.locator("figure")).toHaveCount(26);

  for (const alt of [firstImageAlt, portraitImageAlt]) {
    const image = gallery.locator(`img[alt="${alt}"]`);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(
      () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);

    const ratios = await image.evaluate((element) => {
      const imageElement = element as HTMLImageElement;
      const bounds = imageElement.getBoundingClientRect();
      return {
        natural: imageElement.naturalWidth / imageElement.naturalHeight,
        rendered: bounds.width / bounds.height,
      };
    });
    expect(Math.abs(ratios.natural - ratios.rendered)).toBeLessThan(0.02);
  }

  await page.getByRole("heading", {
    level: 1,
    name: "Hochzeitsfotograf Niedersachsen",
  }).scrollIntoViewIfNeeded();

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-hero.png`,
    fullPage: false,
  });

  await page.getByRole("button", {
    name: `Bild in Vollansicht öffnen: ${firstImageAlt}`,
  }).click();

  const dialog = page.getByRole("dialog", {
    name: "Hochzeit in Niedersachsen in Vollansicht",
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

test("mobile report is stable and touch friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();

  const pageState = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    eagerImages: [...document.images].filter((image) => image.loading === "eager").length,
    lazyImages: [...document.images].filter((image) => image.loading === "lazy").length,
  }));
  expect(pageState.overflow).toBe(0);
  expect(pageState.eagerImages).toBe(1);
  expect(pageState.lazyImages).toBe(25);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-hero.png`,
    fullPage: false,
  });

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
