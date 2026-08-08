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

  const cards = page.locator(".journal-card");
  await expect(cards).toHaveCount(expectedPostPaths.length);

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
