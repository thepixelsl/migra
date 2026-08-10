import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/trautermin-hamburg-online-reservieren/";
const canonicalUrl = `https://artbild-fotografie.de${pagePath}`;
const createdOn = "2026-08-09";
const modifiedOn = "2026-08-10";

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

  const singleDestinationCtas = page.locator("[data-single-destination-cta]");
  await expect(singleDestinationCtas).toHaveCount(2);
  expect(
    await singleDestinationCtas.evaluateAll((sections) =>
      sections.map((section) => section.querySelectorAll("a").length),
    ),
  ).toEqual([1, 1]);

  const officialCta = singleDestinationCtas.nth(0).locator("a");
  await expect(officialCta).toHaveAttribute(
    "href",
    "https://standesamtstermine.hamburg.de/",
  );
  await expect(officialCta).toHaveAttribute("target", "_blank");
  await expect(officialCta).toHaveAttribute("rel", /noopener/);
  await expect(officialCta).toHaveAttribute(
    "data-track-event",
    "external_resource_click",
  );
  await expect(officialCta).toHaveAttribute(
    "data-cta-id",
    "traukalender_hamburg_official",
  );

  const registryCta = singleDestinationCtas.nth(1).locator("a");
  await expect(registryCta).toHaveAttribute("href", "/standesamt-hamburg/");
  await expect(registryCta).not.toHaveAttribute("target", "_blank");
  await expect(registryCta).toHaveAttribute("data-track-event", "cta_click");
  await expect(registryCta).toHaveAttribute(
    "data-cta-id",
    "traukalender_hamburg_standesaemter",
  );
  await expect(registryCta).toHaveAttribute(
    "data-section-id",
    "traukalender_hamburg_standesaemter_cta",
  );

  const contentKinds = await page
    .locator(".article-flow > [data-content-kind]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-content-kind")),
    );
  expect(contentKinds).toEqual([
    "text",
    "image",
    "text",
    "image",
    "text",
    "image-text",
    "text",
  ]);
  for (let index = 1; index < contentKinds.length; index += 1) {
    expect([contentKinds[index - 1], contentKinds[index]]).not.toEqual([
      "text",
      "text",
    ]);
  }

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
    dateModified: modifiedOn,
    mainEntityOfPage: { "@id": `${canonicalUrl}#webpage` },
  });
  expect(blogPosting).not.toHaveProperty("datePublished");
  expect(webPage).toMatchObject({
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    primaryImageOfPage: {
      width: 1600,
      height: 2000,
      caption: "Blick aus einem Fenster auf das Hamburger Rathaus und den Rathausmarkt",
      creditText: "Artbild-Fotografie | York Augustin",
      copyrightNotice: "© York Augustin / Artbild-Fotografie",
    },
  });
  expect(webPage.primaryImageOfPage.contentUrl).toContain(
    "trautermin-hamburg-rathaus-titel",
  );
  expect(blogPosting.image).toEqual(
    expect.arrayContaining([
      expect.stringContaining("trautermin-hamburg-rathaus-titel"),
      expect.stringContaining("trautermin-hamburg-rathaus-blumenstrauss"),
    ]),
  );
  const imageGallery = schemaNodes.find((node) => node["@type"] === "ImageGallery");
  expect(imageGallery.image).toHaveLength(4);
  expect(JSON.stringify(schemas)).not.toContain("artbild-fotografie.ch");

  const galleryButtons = page.locator(
    '[data-gallery-trigger="trautermin-hamburg-gallery"]',
  );
  await expect(galleryButtons).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Hochzeitsmomente in Hamburg" })).toBeVisible();

  const heroImage = page.locator(".journal-hero__image img");
  await expect(heroImage).toHaveAttribute(
    "alt",
    "Blick aus einem Fenster auf das Hamburger Rathaus und den Rathausmarkt",
  );
  await expect(heroImage).toHaveAttribute("loading", "eager");
  await expect(heroImage).toHaveAttribute("fetchpriority", "high");
  await expect(heroImage).toHaveAttribute("src", /rathaus-titel.*\.webp$/);

  const interstitialImage = page.locator(".editorial-break img");
  await expect(interstitialImage).toHaveAttribute(
    "alt",
    "Porträt einer Frau mit weißem Blumenstrauß vor dem Hamburger Rathaus",
  );
  await expect(interstitialImage).toHaveAttribute("loading", "lazy");
  await expect(interstitialImage).toHaveAttribute(
    "src",
    /rathaus-blumenstrauss.*\.webp$/,
  );

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

  const registryCta = page.locator(".single-action--registry");
  await registryCta.scrollIntoViewIfNeeded();
  await expect(page.locator("[data-floating-action]")).toHaveAttribute("inert", "");
  await expect(page.locator("[data-floating-action]")).toHaveCSS("opacity", "0");
});
