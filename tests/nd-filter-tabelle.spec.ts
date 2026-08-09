import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const route = "/nd-filter-tabelle/";
const description =
  "Diese Tabelle zeigt die zu wählenden Belichtungszeiten für Langzeitbelichtungen mit Filtern.";

test("restores the complete original ND filter table with accessible semantics", async ({ page }) => {
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    description,
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\S+/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/nd-filter-tabelle/",
  );

  const table = page.getByRole("table", { name: "ND-Filter Tabelle" });
  await expect(table).toBeVisible();
  await expect(table.locator("thead th[scope=col]")).toHaveCount(8);
  await expect(table.locator("tbody tr")).toHaveCount(16);
  await expect(table.locator("tbody th[scope=row]")).toHaveCount(16);
  await expect(table.locator("th, td")).toHaveCount(136);

  await expect(table.locator("thead th")).toHaveText([
    "Belichtungszeit ohne Filter",
    "ND 0.3",
    "ND 0.6",
    "ND 0.9",
    "ND 1.2",
    "ND 1.8",
    "ND 2.1",
    "ND 3.0",
  ]);
  await expect(table.locator("tbody tr").filter({ hasText: "1/250 Sekunde" }).locator("td").last()).toHaveText("4 s");
  await expect(table.locator("tbody tr").filter({ hasText: "1/15 Sekunde" }).locator("td").nth(3)).toHaveText("1 s");
  await expect(table.locator("tbody tr").filter({ hasText: "1/8 Sekunde" }).locator("td").nth(3)).toHaveText("2 s");
  await expect(table.locator("tbody tr").filter({ hasText: "8 Sekunden" }).locator("td").last()).toHaveText("> 20 m");

  const tableText = await table.textContent();
  expect(tableText).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
});

test("keeps the complete table usable on mobile without cropping the document", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });

  const region = page.locator(".nd-filter-table__region");
  await expect(region).toHaveAttribute("role", "region");
  await expect(region).toHaveAttribute("tabindex", "0");
  await region.focus();
  await expect(region).toBeFocused();
  expect(await region.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );

  const measurements = await region.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentOverflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(measurements.scrollWidth).toBeGreaterThan(measurements.clientWidth);
  expect(measurements.documentOverflow).toBe(0);

  await expect(page.locator(".nd-filter-table tbody th").first()).toHaveCSS(
    "position",
    "sticky",
  );
  await expect(page.locator(".migrated-hero img")).toHaveCSS("object-fit", "contain");
});
