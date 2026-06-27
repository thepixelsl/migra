import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pagePath = "/sicherer-kontakt/";
const screenshotDirectory = "screenshots/qa-sicherer-kontakt";

test("secure contact page contains local assets, contact guidance and SEO metadata", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle("Sicherer Kontakt per E-Mail | Artbild-Fotografie Hamburg");
  await expect(page.getByRole("heading", { level: 1, name: "Sicherer Mail-Kontakt" }))
    .toBeVisible();
  await expect(page.getByRole("link", { name: "PGP-Schlüssel" })).toHaveAttribute(
    "href",
    "/downloads/York-Augustin-2C86E0AD-Oeffentlich.asc",
  );
  await expect(
    page.getByRole("link", { name: "York-Augustin-2C86E0AD-Oeffentlich.asc" }),
  ).toHaveAttribute("download", "");
  await expect(page.locator('a[href^="mailto:info@artbild-fotografie.de"]')).toHaveCount(2);

  const mainText = await page.locator("main").innerText();
  expect(mainText).toContain("S/MIME");
  expect(mainText).toContain("PGP-Schlüssel");
  expect(mainText).toContain("RCS");
  expect(mainText).toContain("Datensparsamkeit");
  expect(mainText).toContain("Hamburg");

  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    schema: document.querySelector('script[type="application/ld+json"]')?.textContent,
    imageSources: [...document.images].map((image) => image.currentSrc || image.src),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  expect(metadata.canonical).toBe("https://artbild-fotografie.de/sicherer-kontakt/");
  expect(metadata.schema).toContain("ContactPage");
  expect(metadata.schema).toContain("ProfessionalService");
  expect(metadata.schema).toContain("PostalAddress");
  expect(metadata.schema).toContain("Sicherer E-Mail-Kontakt");
  expect(metadata.schema).toContain("Hamburg");
  expect(metadata.imageSources.some((src) => src.includes("wp-content"))).toBe(false);
  expect(metadata.overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: true,
  });
});

test("secure contact page and mobile menu remain touch friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-mobile-navigation-toggle]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Sicherer Mail-Kontakt" }))
    .toBeVisible();

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heroWidth: document.querySelector(".secure-hero")?.getBoundingClientRect().width,
  }));

  expect(layout.scrollWidth).toBe(layout.clientWidth);
  expect(layout.heroWidth).toBeLessThanOrEqual(layout.clientWidth - 20);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile-page.png`,
    fullPage: true,
  });

  const toggle = page.getByRole("button", { name: "Menü öffnen" });
  await toggle.click();

  const secureContactLink = page.locator(".mobile-navigation__link[href='/sicherer-kontakt/']");
  await expect(secureContactLink).toBeVisible();
  await expect(secureContactLink).toHaveAttribute("href", "/sicherer-kontakt/");

  await page.screenshot({
    path: `${screenshotDirectory}/mobile-menu.png`,
    fullPage: false,
  });
});
