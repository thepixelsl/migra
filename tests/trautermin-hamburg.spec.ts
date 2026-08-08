import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/trautermin-hamburg-online-reservieren/";

test("Traukalender guide uses the site canonical and avoids fixed photography timings", async ({
  page,
}) => {
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/trautermin-hamburg-online-reservieren/",
  );
  await expect(page.locator(".official-calendar-cta")).toHaveAttribute(
    "href",
    "https://standesamtstermine.hamburg.de/",
  );

  const mainText = await page.locator("main").innerText();
  expect(mainText).toContain("Es gibt keine pauschal passende Dauer.");
  expect(mainText).toContain("08.08.2026");
  expect(mainText).not.toContain("1,5 bis 2,5 Stunden");
  expect(mainText).not.toContain("10:30 Uhr");
  expect(mainText).not.toContain("12:45 Uhr");

  const schema = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(schema.join("\n")).not.toContain("artbild-fotografie.ch");
});
