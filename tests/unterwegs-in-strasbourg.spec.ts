import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/unterwegs-in-strasbourg/";
const screenshotDirectory = "screenshots/qa-unterwegs-in-strasbourg";

test("strasbourg article has SEO metadata, local images and migrated content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle("Unterwegs in Strasbourg | Reisefotografie von Artbild-Fotografie");
  await expect(page.getByRole("heading", { level: 1, name: "Unterwegs in Strasbourg" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Strasbourg in Bildern" }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: /Bild in Vollansicht öffnen/ })).toHaveCount(13);

  const mainText = await page.locator("main").innerText();
  expect(mainText).toContain("Kehl");
  expect(mainText).toContain("Paulskirche");
  expect(mainText).toContain("Ponts Couverts");
  expect(mainText).toContain("Protection des Mineurs");
  expect(mainText).toContain("Albert Schweitzer");

  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
    schema: document.querySelector('script[type="application/ld+json"]')?.textContent,
    imageSources: [...document.images].map((image) => image.currentSrc || image.src),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  expect(metadata.canonical).toBe("https://artbild-fotografie.de/unterwegs-in-strasbourg/");
  expect(metadata.description).toContain("Reisefotografie aus Strasbourg");
  expect(metadata.schema).toContain("Article");
  expect(metadata.schema).toContain("ImageGallery");
  expect(metadata.schema).toContain("Strasbourg");
  expect(metadata.schema).toContain("GeoCoordinates");
  expect(metadata.imageSources.some((src) => src.includes("wp-content"))).toBe(false);
  expect(metadata.overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: true,
  });

  await page.locator(".gallery-image-grid").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${screenshotDirectory}/gallery-desktop.png`,
    fullPage: false,
  });
});

test("strasbourg article remains stable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-mobile-navigation-toggle]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Unterwegs in Strasbourg" }))
    .toBeVisible();

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heroWidth: document.querySelector(".strasbourg-hero")?.getBoundingClientRect().width,
    galleryWidth: document.querySelector(".gallery-image-grid")?.getBoundingClientRect().width,
  }));

  expect(layout.scrollWidth).toBe(layout.clientWidth);
  expect(layout.heroWidth).toBeLessThanOrEqual(layout.clientWidth - 20);
  expect(layout.galleryWidth).toBeLessThanOrEqual(layout.clientWidth - 20);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: true,
  });

  await page.locator(".gallery-image-grid").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${screenshotDirectory}/gallery-mobile.png`,
    fullPage: false,
  });
});
