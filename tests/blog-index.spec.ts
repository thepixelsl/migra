import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isMigratedPageIndexable } from "../src/lib/migratedSeoPolicy";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const migratedPages = JSON.parse(
  readFileSync(new URL("../src/data/migratedPages.json", import.meta.url), "utf8"),
) as Array<{ path: string; type: string }>;
const expectedPostPaths = migratedPages
  .filter((entry) => entry.type === "post" && isMigratedPageIndexable(entry.path))
  .map((entry) => entry.path)
  .sort();
const blogMediaExpectations = [
  {
    path: "/trautermin-hamburg-online-reservieren/",
    description:
      "Offizieller Traukalender der Stadt Hamburg für freie Trautermine in den Hamburger Standesämtern.",
    gallerySelector: '[data-gallery-trigger="trautermin-hamburg-gallery"] img',
    galleryCount: 4,
  },
  {
    path: "/braut-fotoshooting-fraser-suites-hamburg/",
    description:
      "Inszeniertes Braut-Editorial in den Fraser Suites Hamburg mit Model, Brautkleid, Styling und Aufnahmen im Hotelzimmer sowie im Treppenhaus.",
    gallerySelector: ".fraser-gallery [data-gallery-trigger] img",
    galleryCount: 28,
  },
  {
    path: "/location-scouting-in-paris/",
    description:
      "Unterwegs in Paris in Vorbereitung für ein Styled Bridal Shooting. Für ein Styled Bridal Fotoshooting war ich jüngst unterwegs in Paris.",
    gallerySelector: ".migrated-gallery img",
    galleryCount: 9,
  },
  {
    path: "/traum-hochzeit-location-hamburg/",
    description:
      "Moin! Du kommst aus Hamburg oder aus dem Norden und bist auf der Suche nach Inspirationen für Deine Hochzeit und suchst vielleicht auch nach dem schönsten Ort?",
    gallerySelector: ".migrated-gallery img",
    galleryCount: 6,
  },
  {
    path: "/unterwegs-in-baden-wuerttemberg/",
    description:
      "Im weichen Licht der untergehenden Sonne haben wir ein paar wundervolle Portraits gemacht.",
    gallerySelector: ".migrated-gallery img",
    galleryCount: 12,
  },
  {
    path: "/nd-filter-tabelle/",
    description:
      "Fallstricke vermeiden Im Sonnenuntergang wird es dunkler noch während Du belichtest. Plane dies mit ein. Im Sonnenaufgang wird es heller, während Du belichtest. Bedenke auch dies.",
    gallerySelector: ".migrated-gallery img",
    galleryCount: 0,
  },
] as const;

test("blog index uses the configured site URL and exposes the indexable migrated posts", async ({
  page,
}) => {
  const response = await page.goto(`${baseUrl}/blog/`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/blog/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://artbild-fotografie.de/blog/",
  );
  await expect(page.getByRole("heading", { name: "Alle Beiträge" })).toBeVisible();
  const pinnedPost = page.locator(".pinned-post");
  await expect(pinnedPost).toHaveAttribute(
    "href",
    "/trautermin-hamburg-online-reservieren/",
  );
  await expect(pinnedPost).toContainText("Traukalender der Stadt Hamburg");
  await expect(pinnedPost).toContainText(
    "Freie Trautermine können für alle Standesämter hamburgweit online reserviert werden.",
  );
  await expect(pinnedPost.locator("img")).toHaveCount(1);
  await expect(pinnedPost.locator("img")).toHaveAttribute("width", /\d+/);
  await expect(pinnedPost.locator("img")).toHaveAttribute("height", /\d+/);

  const cards = page.locator(".journal-card");
  await expect(cards).toHaveCount(expectedPostPaths.length);
  await expect(cards.locator(".journal-card__image img")).toHaveCount(
    expectedPostPaths.length,
  );
  const cardImageHeights = await cards
    .locator(".journal-card__image")
    .evaluateAll((images) =>
      images.map((image) => image.getBoundingClientRect().height),
    );
  expect(cardImageHeights.every((height) => height > 0)).toBe(true);

  const cardPaths = await cards.locator("h3 a").evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
  );
  expect(new Set(cardPaths).size).toBe(cardPaths.length);
  expect([...cardPaths].sort()).toEqual(expectedPostPaths);

  const itemList = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .evaluate((script) => JSON.parse(script.textContent ?? "{}"));
  expect(itemList["@type"]).toBe("CollectionPage");
  expect(itemList.mainEntity.numberOfItems).toBe(cardPaths.length + 1);
  expect(itemList.mainEntity.itemListElement).toHaveLength(cardPaths.length + 1);
  expect(itemList.mainEntity.itemListElement[0]).toMatchObject({
    "@type": "ListItem",
    position: 1,
    url: "https://artbild-fotografie.de/trautermin-hamburg-online-reservieren/",
    name: "Traukalender der Stadt Hamburg",
  });
});

test("visible blog articles expose title images, descriptions, and original galleries", async ({
  page,
}) => {
  for (const article of blogMediaExpectations) {
    const response = await page.goto(`${baseUrl}${article.path}`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status(), article.path).toBe(200);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      article.description,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\S+/,
    );

    const titleImage = page.locator("main header figure img").first();
    await expect(titleImage, article.path).toBeVisible();
    await expect(titleImage).toHaveAttribute("alt", /\S+/);
    await expect(titleImage).toHaveAttribute("width", /\d+/);
    await expect(titleImage).toHaveAttribute("height", /\d+/);

    const galleryImages = page.locator(article.gallerySelector);
    await expect(galleryImages, article.path).toHaveCount(article.galleryCount);
    if (article.galleryCount > 0) {
      const attributes = await galleryImages.evaluateAll((images) =>
        images.map((image) => ({
          alt: image.getAttribute("alt")?.trim() ?? "",
          width: Number(image.getAttribute("width")),
          height: Number(image.getAttribute("height")),
        })),
      );
      expect(attributes.every((image) => image.alt.length > 0)).toBe(true);
      expect(attributes.every((image) => image.width > 0 && image.height > 0)).toBe(true);
    }
  }
});

test("blog index remains readable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/blog/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator(".journal-posts")).toHaveCSS("grid-template-columns", /\d+(\.\d+)?px/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
