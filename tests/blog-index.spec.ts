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
      "Diese Tabelle zeigt die zu wählenden Belichtungszeiten für Langzeitbelichtungen mit Filtern.",
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
  await expect(page).toHaveTitle("Blog | Artbild-Fotografie");
  await expect(page.locator('html[lang="de"]')).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator(".journal-index h1")).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Blog von Artbild-Fotografie mit Planungstipps, Hochzeitsreportagen und Fotografie-Archiv aus Hamburg.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/blog/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://artbild-fotografie.de/blog/",
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "website",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\S+/,
  );
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    /\S+/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
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
  await expect(pinnedPost.locator("img")).toHaveAttribute("alt", /\S+/);

  const cards = page.locator(".journal-card");
  await expect(cards).toHaveCount(expectedPostPaths.length);
  await expect(cards.locator(".journal-card__image img")).toHaveCount(
    expectedPostPaths.length,
  );
  const cardImageAltTexts = await cards
    .locator(".journal-card__image img")
    .evaluateAll((images) =>
      images.map((image) => image.getAttribute("alt")?.trim() ?? ""),
    );
  expect(cardImageAltTexts.every((alt) => alt.length > 0)).toBe(true);
  const cardImageHeights = await cards
    .locator(".journal-card__image")
    .evaluateAll((images) =>
      images.map((image) => image.getBoundingClientRect().height),
    );
  expect(cardImageHeights.every((height) => height > 0)).toBe(true);
  const cardImages = cards.locator(".journal-card__image img");
  for (let index = 0; index < (await cardImages.count()); index += 1) {
    const image = cardImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
      .toBe(true);
  }

  const cardPaths = await cards
    .locator(".journal-card__link")
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
    );
  expect(new Set(cardPaths).size).toBe(cardPaths.length);
  expect([...cardPaths].sort()).toEqual(expectedPostPaths);

  const labelledArticles = await cards.evaluateAll((articles) =>
    articles.map((article) => {
      const labelledBy = article.getAttribute("aria-labelledby");
      const heading = labelledBy ? article.querySelector(`#${labelledBy}`) : null;
      const link = article.querySelector(".journal-card__link");
      return {
        labelledBy,
        headingText: heading?.textContent?.trim() ?? "",
        linkLabelledBy: link?.getAttribute("aria-labelledby"),
      };
    }),
  );
  expect(labelledArticles.every((article) => article.labelledBy)).toBe(true);
  expect(labelledArticles.every((article) => article.headingText.length > 0)).toBe(true);
  expect(
    labelledArticles.every((article) => article.linkLabelledBy === article.labelledBy),
  ).toBe(true);

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

test("blog index keeps its editorial rhythm across desktop, tablet, and mobile", async ({ page }) => {
  const viewports = [
    { width: 1440, height: 1000, stacked: false },
    { width: 820, height: 1180, stacked: true },
    { width: 390, height: 844, stacked: true },
    { width: 320, height: 720, stacked: true },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/blog/`, { waitUntil: "domcontentloaded" });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${viewport.width}px viewport`).toBe(0);

    const cards = page.locator(".journal-card");
    const cardBoxes = await cards.evaluateAll((articles) =>
      articles.map((article) => {
        const image = article
          .querySelector(".journal-card__image")
          ?.getBoundingClientRect();
        const body = article
          .querySelector(".journal-card__body")
          ?.getBoundingClientRect();
        const bounds = article.getBoundingClientRect();
        return {
          articleLeft: bounds.left,
          articleRight: bounds.right,
          image: image && {
            left: image.left,
            right: image.right,
            top: image.top,
            bottom: image.bottom,
          },
          body: body && {
            left: body.left,
            right: body.right,
            top: body.top,
            bottom: body.bottom,
          },
        };
      }),
    );

    expect(
      cardBoxes.every(
        (card) => card.articleLeft >= -0.5 && card.articleRight <= viewport.width + 0.5,
      ),
    ).toBe(true);

    if (viewport.stacked) {
      expect(
        cardBoxes.every(
          (card) => card.image && card.body && card.body.top >= card.image.bottom - 1,
        ),
      ).toBe(true);
    } else {
      expect(cardBoxes[0]?.image?.right).toBeLessThan(cardBoxes[0]?.body?.left ?? 0);
      expect(cardBoxes[1]?.body?.right).toBeLessThan(cardBoxes[1]?.image?.left ?? 0);
    }
  }
});
