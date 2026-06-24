import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pageUrl = `${baseUrl}/gallery/hochzeit-braut-fotoshooting-hamburg/`;
const screenshotDirectory = "screenshots/qa-braut-fotoshooting-hamburg";
const firstImageAlt =
  "Braut Marica mit Schleier beim Fotoshooting im Hotel Atlantic Hamburg";
const landscapeImageAlt =
  "Nahaufnahme der Braut mit Blumen im Haar in einer Hamburger Suite";

mkdirSync(screenshotDirectory, { recursive: true });

test("desktop gallery preserves portrait and landscape formats", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Braut Fotoshooting Hamburg",
    }),
  ).toBeVisible();
  await expect(page.locator(".gallery-nav")).toBeVisible();

  const gallery = page.getByRole("region", {
    name: "Braut Fotoshooting und Getting Ready im Hotel Atlantic Hamburg",
  });
  await expect(gallery.locator("figure")).toHaveCount(52);

  for (const alt of [firstImageAlt, landscapeImageAlt]) {
    const image = gallery.locator(`img[alt="${alt}"]`);
    await expect(image).toBeVisible();
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
    name: "Braut Fotoshooting Hamburg",
  }).scrollIntoViewIfNeeded();

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-hero.png`,
    fullPage: false,
  });

  await page.getByRole("button", {
    name: `Bild in Vollansicht öffnen: ${firstImageAlt}`,
  }).click();

  const dialog = page.getByRole("dialog", {
    name: "Braut Fotoshooting Hamburg in Vollansicht",
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

test("mobile gallery is stable and touch friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();

  const pageState = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    eagerImages: [...document.images].filter((image) => image.loading === "eager").length,
  }));
  expect(pageState.overflow).toBe(0);
  expect(pageState.eagerImages).toBe(1);

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
