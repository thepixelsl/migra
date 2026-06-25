import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/gallery/getting-ready-hamburg/";
const screenshotDirectory = "screenshots/qa-getting-ready-hamburg";

test("desktop Getting Ready gallery preserves portraits and opens the lightbox", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Getting Ready Hamburg" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid__item")).toHaveCount(84);
  await expect
    .poll(() =>
      page
        .locator(".getting-ready-hero figure img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);

  const ratios = await page.locator(".gallery-image-grid__item img").evaluateAll((images) =>
    images.map((image: HTMLImageElement) =>
      Number(image.getAttribute("width")) / Number(image.getAttribute("height")),
    ),
  );
  expect(ratios.some((ratio) => ratio < 0.8)).toBe(true);
  expect(ratios.some((ratio) => ratio > 1.35)).toBe(true);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop-hero.png`,
    fullPage: false,
  });

  const triggers = page.locator("[data-gallery-trigger='getting-ready-hamburg']");
  expect(await triggers.count()).toBe(84);
  await triggers.first().click();

  const dialog = page.getByRole("dialog", {
    name: "Getting Ready Hamburg in Vollansicht",
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Vorheriges Bild" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nächstes Bild" })).toBeVisible();

  await page.getByRole("button", { name: "Vollansicht schließen" }).last().click();
  await expect(dialog).toBeHidden();

  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    schema: document.querySelector('script[type="application/ld+json"]')?.textContent,
  }));
  expect(metadata.canonical).toBe(
    "https://artbild-fotografie.de/gallery/getting-ready-hamburg/",
  );
  expect(metadata.schema).toContain("ImageGallery");
  expect(metadata.schema).toContain("Hamburg");

  await page.locator(".gallery-image-grid").scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `${screenshotDirectory}/desktop-gallery.png`,
    fullPage: false,
  });

  await page.locator(".gallery-image-grid__item").nth(60).scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `${screenshotDirectory}/desktop-gallery-late.png`,
    fullPage: false,
  });
});

test("mobile Getting Ready gallery is touch friendly and has no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid")).toHaveCSS("grid-template-columns", "366px");

  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heroWidth: document.querySelector(".getting-ready-hero")?.getBoundingClientRect().width,
  }));
  expect(layout.overflow).toBe(0);
  expect(layout.heroWidth).toBeLessThanOrEqual(358);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
