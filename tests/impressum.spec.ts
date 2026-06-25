import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/impressum/";
const screenshotDirectory = "screenshots/qa-impressum";

test("impressum contains complete provider details and legal sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle("Impressum | Artbild-Fotografie Hamburg");
  await expect(page.getByRole("heading", { level: 1, name: "Impressum" })).toBeVisible();
  const mainText = await page.locator("main").innerText();
  expect(mainText.match(/Rahlstedter Bahnhofstraße 27/g)).toHaveLength(3);
  await expect(page.getByRole("link", { name: "+49 151 614 38 120" })).toHaveAttribute(
    "href",
    "tel:+4915161438120",
  );
  await expect(
    page.getByRole("link", { name: "info@artbild-fotografie.de" }),
  ).toHaveAttribute("href", "mailto:info@artbild-fotografie.de");
  await expect(
    page.getByRole("heading", { level: 2, name: "Haftung für Inhalte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Hinweis zur Verbraucherstreitbeilegung" }),
  ).toBeVisible();

  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    schema: document.querySelector('script[type="application/ld+json"]')?.textContent,
  }));

  expect(metadata.canonical).toBe("https://artbild-fotografie.de/impressum/");
  expect(metadata.schema).toContain("ProfessionalService");
  expect(metadata.schema).toContain("PostalAddress");

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: true,
  });
});

test("mobile impressum remains readable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-mobile-navigation-toggle]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Impressum" })).toBeVisible();

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    contactWidth: document.querySelector(".legal-contact")?.getBoundingClientRect().width,
  }));

  expect(layout.scrollWidth).toBe(layout.clientWidth);
  expect(layout.contactWidth).toBeLessThanOrEqual(layout.clientWidth - 30);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: true,
  });
});
