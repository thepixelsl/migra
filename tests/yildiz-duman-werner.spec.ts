import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/gallery/yildiz-duman-werner/";
const screenshotDirectory = "screenshots/qa-yildiz-duman-werner";

test("desktop Yildiz profile has authentic content, local images and complete schema", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Yildiz Duman-Werner, Brautstylistin in Hamburg",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Bei den hier gezeigten Editorials war sie für Hair & Make-up verantwortlich."),
  ).toBeVisible();
  await expect(page.locator("[data-gallery-trigger='yildiz-duman-werner']")).toHaveCount(5);

  const officialLink = page.getByRole("link", {
    name: "Offizielle Website ansehen ↗",
  });
  await expect(officialLink).toHaveAttribute(
    "href",
    "https://hamburgbrautstyling.com/",
  );
  await expect(officialLink).toHaveAttribute("rel", "noopener");

  const state = await page.evaluate(() => {
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent ?? "{}"));
    const schemaNodes = schemas.flatMap((schema) => schema["@graph"] ?? [schema]);
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;

      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };
    const normalizedText = (selector: string) =>
      document.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, " ").trim() ??
      null;
    const galleryImages = [
      ...document.querySelectorAll<HTMLImageElement>(".gallery-image-grid img"),
    ];
    const heroImage = document.querySelector<HTMLImageElement>(".stylist-hero figure img");

    return {
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      centers: {
        nav: centerDelta(".gallery-nav"),
        hero: centerDelta(".stylist-hero"),
        collaboration: centerDelta(".stylist-collaboration"),
        gallery: centerDelta(".gallery-image-grid"),
      },
      missingAlt: [...document.images].filter((image) => !image.alt).length,
      lazyImages: galleryImages.filter((image) => image.loading === "lazy").length,
      naturalItems: document.querySelectorAll(".gallery-image-grid__item.is-natural").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      schemaTypes: schemaNodes.map((node: { "@type": string }) => node["@type"]),
      hasProviderEntity: JSON.stringify(schemas).includes("Dizzy Dee Styles"),
      hasUnsupportedProviderSchema:
        JSON.stringify(schemas).includes("BeautySalon") ||
        JSON.stringify(schemas).includes("FAQPage"),
      hasArtbildOnlyPhotographyServices:
        JSON.stringify(
          schemaNodes.find(
            (node: { "@id"?: string }) => node["@id"]?.endsWith("/#organization"),
          ),
        ).includes("Hochzeitsfotografie") &&
        !JSON.stringify(
          schemaNodes.find(
            (node: { "@id"?: string }) => node["@id"]?.endsWith("/#organization"),
          ),
        ).includes("Brautstyling"),
      localGalleryImages: galleryImages.every(
        (image) =>
          !image.currentSrc.includes("hamburgbrautstyling.com") &&
          !image.currentSrc.includes("wp-content"),
      ),
      heroObjectFit: heroImage ? getComputedStyle(heroImage).objectFit : null,
      collaborationText: normalizedText(
        ".stylist-collaboration > div:last-child p:first-child",
      ),
    };
  });

  expect(state.canonical).toBe(
    "https://artbild-fotografie.de/gallery/yildiz-duman-werner/",
  );
  expect(state.description).toContain("Yildiz Duman-Werner");
  expect(state.centers.nav).toBe(0);
  expect(state.centers.hero).toBe(0);
  expect(state.centers.collaboration).toBe(0);
  expect(state.centers.gallery).toBe(0);
  expect(state.missingAlt).toBe(0);
  expect(state.lazyImages).toBe(5);
  expect(state.naturalItems).toBe(5);
  expect(state.overflow).toBe(0);
  expect(state.schemaTypes).toEqual(
    expect.arrayContaining([
      "Article",
      "ImageGallery",
      "Person",
      "ProfessionalService",
      "BreadcrumbList",
      "WebPage",
    ]),
  );
  expect(state.hasProviderEntity).toBe(true);
  expect(state.hasUnsupportedProviderSchema).toBe(false);
  expect(state.hasArtbildOnlyPhotographyServices).toBe(true);
  expect(state.localGalleryImages).toBe(true);
  expect(state.heroObjectFit).toBe("cover");
  expect(state.collaborationText).toContain(
    "Die Galerie zeigt die Looks in nahen Beauty-Portraits",
  );

  await page.locator("[data-gallery-trigger='yildiz-duman-werner']").first().click();
  const dialog = page.getByRole("dialog", {
    name: "Brautstyling von Yildiz Duman-Werner in Vollansicht",
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

test("mobile Yildiz profile remains centered and free of horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  const mobileState = await page.evaluate(() => {
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;

      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };
    const heading = document.querySelector<HTMLElement>(".stylist-hero h1");
    const ctaKicker = document.querySelector<HTMLElement>(".stylist-cta .stylist-kicker");
    const ctaKickerStyles = ctaKicker ? getComputedStyle(ctaKicker) : null;

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mobileNavVisible:
        getComputedStyle(document.querySelector(".mobile-navigation")!).display !== "none",
      desktopNavVisible:
        getComputedStyle(document.querySelector(".gallery-nav")!).display !== "none",
      headingOverflow: heading ? heading.scrollWidth - heading.clientWidth : null,
      centers: {
        mobileBar: centerDelta(".mobile-navigation__bar"),
        hero: centerDelta(".stylist-hero"),
        collaboration: centerDelta(".stylist-collaboration"),
        gallery: centerDelta(".gallery-image-grid"),
      },
      ctaKicker: {
        fontFamily: ctaKickerStyles?.fontFamily ?? null,
        marginBottom: ctaKickerStyles?.marginBottom ?? null,
      },
    };
  });

  expect(mobileState.overflow).toBe(0);
  expect(mobileState.mobileNavVisible).toBe(true);
  expect(mobileState.desktopNavVisible).toBe(false);
  expect(mobileState.headingOverflow).toBeLessThanOrEqual(1);
  expect(mobileState.centers.mobileBar).toBe(0);
  expect(mobileState.centers.hero).toBe(0);
  expect(mobileState.centers.collaboration).toBe(0);
  expect(mobileState.centers.gallery).toBe(0);
  expect(mobileState.ctaKicker.fontFamily).toContain("Raleway");
  expect(mobileState.ctaKicker.marginBottom).toBe("18px");

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});

test("Yildiz profile is discoverable from the vendor hub, homepage and Zurich editorial", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/brautstyling-hamburg/`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.locator(`.bridal-vendor-card a[href="${pagePath}"]`),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Yildiz Duman-Werner" }),
  ).toBeVisible();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator(`.vendor-grid a[href="${pagePath}"]`),
  ).toHaveCount(1);

  await page.goto(`${baseUrl}/brautpaar-in-zuerich/`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.locator(`.zurich-hero a[href="${pagePath}"]`),
  ).toHaveText("Hamburg Brautstyling");
});
