import { expect, test } from "@playwright/test";
import { MIGRATED_NOINDEX_RULES } from "../src/lib/migratedSeoPolicy";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("legacy SEO policy noindexes every explicit exception and uses only deliberate canonicals", async ({
  page,
}) => {
  for (const [pagePath, rule] of Object.entries(MIGRATED_NOINDEX_RULES)) {
    const response = await page.goto(`${baseUrl}${pagePath}`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status(), pagePath).toBe(200);
    await expect(page.locator('meta[name="robots"]'), pagePath).toHaveAttribute(
      "content",
      "noindex, follow",
    );

    const expectedCanonicalPath = rule.canonicalPath ?? pagePath;
    await expect(page.locator('link[rel="canonical"]'), pagePath).toHaveAttribute(
      "href",
      `https://artbild-fotografie.de${expectedCanonicalPath}`,
    );
    await expect(page.locator('script[type="application/ld+json"]'), pagePath).toHaveCount(0);
  }
});

test("ordinary migrated pages retain indexable metadata and a self canonical", async ({ page }) => {
  const pagePath = "/nd-filter-tabelle/";
  const response = await page.goto(`${baseUrl}${pagePath}`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/nd-filter-tabelle/",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test("the wedding photo backup article is indexable", async ({ page }) => {
  const pagePath = "/wie-sollte-man-hochzeitsfotos-sichern/";
  const response = await page.goto(`${baseUrl}${pagePath}`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/wie-sollte-man-hochzeitsfotos-sichern/",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});
