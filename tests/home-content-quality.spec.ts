import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("homepage uses concrete copy and matching structured data", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/",
  );

  const pageText = (await page.locator("body").textContent()) ?? "";
  expect(pageText).toContain("Oldtimer, Ringtausch, Baumstammsägen");
  expect(pageText).toContain("greife möglichst wenig ein");
  expect(pageText).toContain("Termine, Gebühren und Kapazitäten bestätigt Ihr direkt");
  expect(pageText).not.toContain("mit Blick für die kleinen Zwischentöne");
  expect(pageText).not.toContain("großen und kleinen Gänsehaut-Momente");
  expect(pageText).not.toContain("Vom hanseatischen Rathaus bis zum Ja-Wort");
  expect(pageText).not.toContain("After-Wedding-Shooting");

  const schemaText = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(schemaText).not.toBeNull();
  expect(schemaText).not.toContain("After-Wedding-Shooting");
  expect(schemaText).toContain("Standesamtliche Trauungen in Hamburg");
});
