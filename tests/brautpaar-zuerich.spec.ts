import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/brautpaar-in-zuerich/";
const screenshotDirectory = "screenshots/qa-brautpaar-zuerich";

test("desktop article migrates the Zurich elopement gallery with lazy images", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Styled Editorial in Zürich" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid__item")).toHaveCount(48);

  const state = await page.evaluate(() => {
    const schemas = [...document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    )].map((script) => JSON.parse(script.textContent ?? "{}"));
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };

    return {
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      lazyGalleryImages: [
        ...document.querySelectorAll<HTMLImageElement>(".gallery-image-grid__item img"),
      ].filter((image) => image.loading === "lazy").length,
      missingAlt: [...document.images].filter((image) => !image.alt).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      centers: {
        nav: centerDelta(".gallery-nav"),
        hero: centerDelta(".zurich-hero"),
        gallery: centerDelta(".gallery-image-grid"),
      },
      schemaTypes: schemas.flatMap((schema) => [
        ...(schema["@type"] ? [schema["@type"]] : []),
        ...(schema["@graph"]?.map((node: { "@type": string }) => node["@type"]) ?? []),
      ]),
    };
  });

  expect(state.canonical).toBe("https://artbild-fotografie.de/brautpaar-in-zuerich/");
  expect(state.lazyGalleryImages).toBe(48);
  expect(state.missingAlt).toBe(0);
  expect(state.overflow).toBe(0);
  expect(state.centers.nav).toBe(0);
  expect(state.centers.hero).toBe(0);
  expect(state.centers.gallery).toBe(0);
  expect(state.schemaTypes).toEqual(
    expect.arrayContaining(["Article", "ImageGallery", "City", "BreadcrumbList", "WebPage"]),
  );

  const triggers = page.locator("[data-gallery-trigger='brautpaar-zuerich']");
  expect(await triggers.count()).toBe(48);
  await triggers.first().click();

  const dialog = page.getByRole("dialog", {
    name: "Brautpaar in Zürich in Vollansicht",
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

test("mobile Zurich article keeps the gallery centered and touch friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
  await expect(page.locator(".gallery-image-grid")).toHaveCSS("display", "flex");
  await expect(page.locator(".gallery-image-grid")).toHaveCSS("flex-wrap", "wrap");

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
      centers: {
        mobileBar: centerDelta(".mobile-navigation__bar"),
        hero: centerDelta(".zurich-hero"),
        gallery: centerDelta(".gallery-image-grid"),
      },
      galleryItems: [...document.querySelectorAll<HTMLElement>(".gallery-image-grid__item")]
        .map((item) => item.getBoundingClientRect())
        .map(({ left, width, height }) => ({ left, width, height })),
    };
  });

  expect(mobileState.overflow).toBe(0);
  expect(mobileState.centers.mobileBar).toBe(0);
  expect(mobileState.centers.hero).toBe(0);
  expect(mobileState.centers.gallery).toBe(0);
  expect(mobileState.galleryItems.every(({ height }) => height > 0)).toBe(true);
  expect(new Set(mobileState.galleryItems.map(({ left }) => Math.round(left))).size).toBe(1);
  expect(new Set(mobileState.galleryItems.map(({ width }) => Math.round(width))).size).toBe(1);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
