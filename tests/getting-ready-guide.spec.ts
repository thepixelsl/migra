import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/das-perfekte-getting-ready-fuer-deine-hochzeit-in-hamburg/";
const screenshotDirectory = "screenshots/qa-getting-ready-guide";

mkdirSync(screenshotDirectory, { recursive: true });

test("Getting Ready guide has complete SEO structure and optimized gallery", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Das perfekte Getting Ready für deine Hochzeit in Hamburg",
    }),
  ).toBeVisible();
  await expect(page.locator("[data-gallery-trigger='getting-ready-guide']")).toHaveCount(84);

  const metadata = await page.evaluate(() => {
    const schema = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}",
    );
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;

      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };
    const heroFigures = [...document.querySelectorAll<HTMLElement>(".gr-guide-hero__images figure")]
      .map((figure) => figure.getBoundingClientRect())
      .sort((a, b) => a.left - b.left);

    return {
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      centers: {
        nav: centerDelta(".gallery-nav"),
        hero: centerDelta(".gr-guide-hero"),
        intro: centerDelta(".gr-guide-section"),
      },
      heroImageGaps: heroFigures.slice(1).map((figure, index) =>
        Math.round(figure.left - heroFigures[index].right),
      ),
      missingAlt: [...document.images].filter((image) => !image.alt).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      schemaTypes: schema["@graph"]?.map((node: { "@type": string }) => node["@type"]),
    };
  });

  expect(metadata.canonical).toBe(
    "https://artbild-fotografie.de/das-perfekte-getting-ready-fuer-deine-hochzeit-in-hamburg/",
  );
  expect(metadata.description).toContain("Getting Ready Hamburg");
  expect(metadata.centers.nav).toBe(0);
  expect(metadata.centers.hero).toBe(0);
  expect(metadata.centers.intro).toBe(0);
  expect(Math.min(...metadata.heroImageGaps)).toBeGreaterThanOrEqual(14);
  expect(metadata.missingAlt).toBe(0);
  expect(metadata.overflow).toBe(0);
  expect(metadata.schemaTypes).toEqual(
    expect.arrayContaining([
      "Article",
      "FAQPage",
      "ImageGallery",
      "City",
      "ProfessionalService",
      "BreadcrumbList",
      "WebPage",
    ]),
  );

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-hero.png`,
    fullPage: false,
  });

  await page.locator("#bilder").scrollIntoViewIfNeeded();
  const galleryAlignment = await page.evaluate(() => {
    const viewportCenter = document.documentElement.clientWidth / 2;
    const element = document.querySelector<HTMLElement>(".gr-guide-gallery .gallery-image-grid");
    if (!element) return null;

    const bounds = element.getBoundingClientRect();
    return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
  });
  expect(galleryAlignment).toBe(0);

  await page.screenshot({
    path: `${screenshotDirectory}/desktop-gallery.png`,
    fullPage: false,
  });
});

test("Getting Ready guide is mobile friendly and keeps navigation usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  const mobileLayout = await page.evaluate(() => {
    const heroFigures = [...document.querySelectorAll<HTMLElement>(".gr-guide-hero__images figure")]
      .map((figure) => figure.getBoundingClientRect())
      .sort((a, b) => a.left - b.left);

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mobileNavVisible: getComputedStyle(document.querySelector(".mobile-navigation")!).display !== "none",
      desktopNavVisible: getComputedStyle(document.querySelector(".gallery-nav")!).display !== "none",
      heroImageGaps: heroFigures.slice(1).map((figure, index) =>
        Math.round(figure.left - heroFigures[index].right),
      ),
      centers: (() => {
        const viewportCenter = document.documentElement.clientWidth / 2;
        const centerDelta = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return null;

          const bounds = element.getBoundingClientRect();
          return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
        };

        return {
          mobileBar: centerDelta(".mobile-navigation__bar"),
          hero: centerDelta(".gr-guide-hero"),
          gallery: centerDelta(".gr-guide-gallery .gallery-image-grid"),
        };
      })(),
    };
  });

  expect(mobileLayout.overflow).toBe(0);
  expect(mobileLayout.mobileNavVisible).toBe(true);
  expect(mobileLayout.desktopNavVisible).toBe(false);
  expect(mobileLayout.centers.mobileBar).toBe(0);
  expect(mobileLayout.centers.hero).toBe(0);
  expect(mobileLayout.centers.gallery).toBe(0);
  expect(Math.min(...mobileLayout.heroImageGaps)).toBeGreaterThanOrEqual(8);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-hero.png`,
    fullPage: false,
  });

  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await expect(page.locator(`.mobile-navigation__link[href="${pagePath}"]`)).toHaveAttribute(
    "aria-current",
    "page",
  );

  const touchTargets = await page
    .locator(".mobile-navigation__link")
    .evaluateAll((links) => links.slice(0, 4).map((link) => link.getBoundingClientRect().height));
  expect(touchTargets.every((height) => height >= 44)).toBe(true);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-menu.png`,
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await page.locator("#bilder").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${screenshotDirectory}/mobile-gallery.png`,
    fullPage: false,
  });
});
