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

  await expect(page).toHaveTitle(
    "Kontakt und öffentlicher PGP-Schlüssel | Artbild-Fotografie",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Kontakt und PGP-Schlüssel" }))
    .toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Sicherer Kontakt für Mitarbeitende von Behörden und Organisationen mit Sicherheitsaufgaben, Angehörige des Diplomatischen Dienstes und für Hochzeiten mit diskretem Personenschutz",
      exact: true,
    }),
  ).toBeVisible();
  const pgpDownload = page.getByRole("link", { name: "Öffentlichen PGP-Schlüssel herunterladen" });
  await expect(pgpDownload).toHaveAttribute("href", "/downloads/York-Augustin-2C86E0AD-Oeffentlich.asc");
  await expect(pgpDownload).toHaveAttribute("download", "");
  await expect(
    page.locator('.secure-mail-cta a[href^="mailto:info@artbild-fotografie.de"]'),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Jetzt ansehen!" }),
  ).toHaveAttribute("href", "/gallery/paarshooting-mallorca/");

  await expect(page.locator("main p")).toHaveText([
    "Zunächst muss ich prüfen, ob ich an Ihrem Wunschtermin verfügbar bin. Erst danach sollten weitere Informationen mitgeteilt werden.",
    "Herzlichen Dank!",
    "Mit einem tollen Paarshooting von Artbild-Fotografie versüßte sich dieses Paar ihre Erinnerung in ihrer Wohnung auf Mallorca. Die beiden haben mir erlaubt, Euch ein paar Bilder davon zu zeigen.",
  ]);

  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    schema: document.querySelector('script[type="application/ld+json"]')?.textContent,
    imageSources: [...document.images].map((image) => image.currentSrc || image.src),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hero: document.querySelector(".secure-hero")?.getBoundingClientRect(),
    heroImage: document.querySelector(".secure-hero img")?.getBoundingClientRect(),
  }));

  expect(metadata.canonical).toBe("https://artbild-fotografie.de/sicherer-kontakt/");
  expect(metadata.schema).toContain("ContactPage");
  expect(metadata.schema).not.toContain("FAQPage");
  expect(metadata.schema).toContain("ProfessionalService");
  expect(metadata.schema).toContain("PostalAddress");
  expect(metadata.schema).toContain("PGP-Schlüssel");
  expect(metadata.schema).not.toContain("S/MIME-Zertifikat");
  expect(metadata.schema).not.toContain("Ende-zu-Ende-Verschlüsselung");
  expect(metadata.schema).toContain("Hamburg");
  expect(metadata.imageSources.some((src) => src.includes("wp-content"))).toBe(false);
  expect(metadata.imageSources.some((src) => src.includes("ART0759"))).toBe(true);
  expect(metadata.imageSources.some((src) => src.includes("ART3390"))).toBe(false);
  expect(metadata.hero?.width).toBeCloseTo(metadata.heroImage?.width ?? 0, 0);
  expect(metadata.hero?.height).toBeCloseTo(metadata.heroImage?.height ?? 0, 0);
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
  await expect(page.getByRole("heading", { level: 1, name: "Kontakt und PGP-Schlüssel" }))
    .toBeVisible();

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heroWidth: document.querySelector(".secure-hero")?.getBoundingClientRect().width,
    heroImagePosition: getComputedStyle(
      document.querySelector(".secure-hero img") as HTMLElement,
    ).position,
  }));

  expect(layout.scrollWidth).toBe(layout.clientWidth);
  expect(layout.heroWidth).toBeLessThanOrEqual(layout.clientWidth - 20);
  expect(layout.heroImagePosition).toBe("absolute");

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile-page.png`,
    fullPage: true,
  });

  const toggle = page.getByRole("button", { name: "Menü öffnen" });
  await toggle.click();

  await expect(page.locator("[data-mobile-navigation-panel]")).toBeVisible();
  const contactLink = page.locator(".mobile-navigation__link[href='/kontakt/']");
  await expect(contactLink).toBeVisible();
  await expect(contactLink).toHaveAttribute("href", "/kontakt/");

  await page
    .locator("[data-mobile-navigation-panel] [data-mobile-navigation-close]")
    .last()
    .click();
  await expect(page.locator("[data-mobile-navigation-panel]")).toBeHidden();
});
