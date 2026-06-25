import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/gallery/traumhochzeit-in-paris/";
const screenshotDirectory = "screenshots/qa-traumhochzeit-paris";

test("desktop Paris gallery has SEO structure, local images and lightbox", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Traumhochzeit in Paris" })).toBeVisible();
  await expect(page.locator("[data-gallery-trigger='traumhochzeit-paris']")).toHaveCount(4);

  const state = await page.evaluate(() => {
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

    return {
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      centers: {
        nav: centerDelta(".gallery-nav"),
        hero: centerDelta(".paris-hero"),
        story: centerDelta(".paris-story"),
        gallery: centerDelta(".gallery-image-grid"),
      },
      missingAlt: [...document.images].filter((image) => !image.alt).length,
      lazyImages: [...document.querySelectorAll<HTMLImageElement>(".gallery-image-grid img")]
        .filter((image) => image.loading === "lazy").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      schemaTypes: schema["@graph"]?.map((node: { "@type": string }) => node["@type"]),
      hasParisPlace: JSON.stringify(schema).includes('"Paris"'),
    };
  });

  expect(state.canonical).toBe("https://artbild-fotografie.de/gallery/traumhochzeit-in-paris/");
  expect(state.description).toContain("Hochzeitsfotografie in Paris");
  expect(state.centers.nav).toBe(0);
  expect(state.centers.hero).toBe(0);
  expect(state.centers.story).toBe(0);
  expect(state.centers.gallery).toBe(0);
  expect(state.missingAlt).toBe(0);
  expect(state.lazyImages).toBe(3);
  expect(state.overflow).toBe(0);
  expect(state.schemaTypes).toEqual(
    expect.arrayContaining([
      "Article",
      "ImageGallery",
      "City",
      "ProfessionalService",
      "BreadcrumbList",
      "WebPage",
    ]),
  );
  expect(state.hasParisPlace).toBe(true);

  await page.locator("[data-gallery-trigger='traumhochzeit-paris']").first().click();
  const dialog = page.getByRole("dialog", {
    name: "Traumhochzeit in Paris in Vollansicht",
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Vorheriges Bild" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nächstes Bild" })).toBeVisible();
  await page.getByRole("button", { name: "Vollansicht schließen" }).last().click();
  await expect(dialog).toBeHidden();

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: false,
  });
});

test("mobile Paris gallery is touch friendly and centered", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  const mobileState = await page.evaluate(() => {
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;

      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mobileNavVisible: getComputedStyle(document.querySelector(".mobile-navigation")!).display !== "none",
      desktopNavVisible: getComputedStyle(document.querySelector(".gallery-nav")!).display !== "none",
      centers: {
        mobileBar: centerDelta(".mobile-navigation__bar"),
        hero: centerDelta(".paris-hero"),
        story: centerDelta(".paris-story"),
        gallery: centerDelta(".gallery-image-grid"),
      },
    };
  });

  expect(mobileState.overflow).toBe(0);
  expect(mobileState.mobileNavVisible).toBe(true);
  expect(mobileState.desktopNavVisible).toBe(false);
  expect(mobileState.centers.mobileBar).toBe(0);
  expect(mobileState.centers.hero).toBe(0);
  expect(mobileState.centers.story).toBe(0);
  expect(mobileState.centers.gallery).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
