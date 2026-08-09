import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/trautermin-hamburg-online-reservieren/";
const canonicalUrl = `https://artbild-fotografie.de${pagePath}`;
const createdOn = "2026-08-09";

test("Traukalender article keeps York's original wording and coherent metadata", async ({
  page,
}) => {
  const response = await page.goto(`${baseUrl}${pagePath}`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Traukalender der Stadt Hamburg",
  })).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    canonicalUrl,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /index, follow/,
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Offizieller Traukalender der Stadt Hamburg für freie Trautermine in den Hamburger Standesämtern.",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Freie Trautermine können für alle Standesämter hamburgweit online reserviert werden.",
  );
  await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0);
  await expect(page.locator(".official-calendar-cta")).toHaveAttribute(
    "href",
    "https://standesamtstermine.hamburg.de/",
  );

  const mainText = await page.locator("main").innerText();
  for (const originalPassage of [
    "Freie Trautermine können für alle Standesämter hamburgweit online reserviert werden.",
    "Die Erreichbarkeiten können stark unterschiedlich sein, daher empfehle ich Euch, rechtzeitig Kontakt zu Eurem Standesamt aufzunehmen.",
    "Ich, als Hochzeitsfotograf in Hamburg, erzähle Eure Geschichte. Ich friere Eure Momente für die Ewigkeit ein.",
    "Natürlich, unverfälscht und echt.",
    "09.08.2026",
  ]) {
    expect(mainText).toContain(originalPassage);
  }

  for (const staleClaim of [
    "1,5 bis 2,5 Stunden",
    "10:30 Uhr",
    "12:45 Uhr",
    "54 Euro",
    "12 Euro",
    "2023",
    "Corona",
    "ein Jahr im voraus",
    "6 - 12 Monate",
  ]) {
    expect(mainText.toLocaleLowerCase("de-DE")).not.toContain(
      staleClaim.toLocaleLowerCase("de-DE"),
    );
  }

  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map((script) => JSON.parse(script.textContent ?? "{}")),
    );
  const schemaNodes = schemas.flatMap((schema) => schema["@graph"] ?? [schema]);
  const schemaTypes = schemaNodes.map((node) => node["@type"]);
  const blogPosting = schemaNodes.find((node) => node["@type"] === "BlogPosting");
  const webPage = schemaNodes.find((node) => node["@type"] === "WebPage");

  expect(schemaTypes).toContain("BlogPosting");
  expect(schemaTypes).toContain("WebPage");
  expect(schemaTypes).toContain("BreadcrumbList");
  expect(schemaTypes).toContain("ImageGallery");
  expect(schemaTypes).not.toContain("FAQPage");
  expect(blogPosting).toMatchObject({
    headline: "Traukalender der Stadt Hamburg",
    dateCreated: createdOn,
    dateModified: createdOn,
    mainEntityOfPage: { "@id": `${canonicalUrl}#webpage` },
  });
  expect(blogPosting).not.toHaveProperty("datePublished");
  expect(webPage).toMatchObject({
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
  });
  const imageGallery = schemaNodes.find((node) => node["@type"] === "ImageGallery");
  expect(imageGallery.image).toHaveLength(4);
  expect(JSON.stringify(schemas)).not.toContain("artbild-fotografie.ch");

  const galleryButtons = page.locator(
    '[data-gallery-trigger="trautermin-hamburg-gallery"]',
  );
  await expect(galleryButtons).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Hochzeitsmomente in Hamburg" })).toBeVisible();

  const imageAttributes = await page
    .locator("main img:not([data-gallery-image])")
    .evaluateAll((images) =>
    images.map((image) => ({
      alt: image.getAttribute("alt"),
      width: Number(image.getAttribute("width")),
      height: Number(image.getAttribute("height")),
    })),
    );
  expect(imageAttributes.length).toBeGreaterThan(0);
  for (const image of imageAttributes) {
    expect(image.alt?.trim().length).toBeGreaterThan(0);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  }
});

test("Traukalender article remains readable without horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await expect(page.locator(".official-calendar-cta")).toBeVisible();
});
