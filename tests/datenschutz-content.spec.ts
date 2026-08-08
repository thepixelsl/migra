import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const removedLegacyTerms = [
  "WordPress",
  "Borlabs",
  "Google Site Kit",
  "Cloudflare Germany GmbH",
  "Bereitstellung über Cloudflare",
  "Cloudflare Worker konfiguriert",
  "Pinterest-Plugin",
  "Browser-Plugin",
  "Facebook-Plugins",
  "MailChimp",
  "Privacy Shield Framework",
];

test("privacy page documents the Bunny architecture and actual contact data flow", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/datenschutz/`, { waitUntil: "domcontentloaded" });

  const main = page.locator("main");
  const mainText = await main.innerText();

  expect(mainText).toContain("Stand: 8. August 2026");
  expect(mainText).toContain("bunny.net Magic Containers");
  expect(mainText).toContain("Bunny-CDN-Endpunkt");
  expect(mainText).toContain("Bunny Database");
  expect(mainText).toContain("BunnyWay d.o.o.");
  expect(mainText).toContain("Dunajska cesta 165");
  expect(mainText).toContain("globales CDN");
  expect(mainText).toContain("nach dem verwendeten Bunny-Dienst");

  expect(mainText).toContain("SHA-256-Hash der IP-Adresse");
  expect(mainText).toContain("Inhalte hochgeladener Dateien werden nicht in Bunny Database gespeichert");
  expect(mainText).toContain("Eine feste automatische Löschroutine ist derzeit nicht eingerichtet");
  expect(mainText).toContain("STRATO GmbH");
  expect(mainText).toContain("technischen HTTPS-Relay auf Cloudflare Workers");
  expect(mainText).toContain("Kontakt über WhatsApp");
  expect(mainText).toContain("WhatsApp Ireland Limited");

  expect(mainText).toContain("First-Party-Cookie artbild_consent");
  expect(mainText).toContain("maximale Laufzeit beträgt 180 Tage");
  expect(mainText).toContain("PicDrop GmbH");
  expect(mainText).toContain("Am Kupfergraben 4/4a");

  await expect(main.locator('a[href="https://bunny.net/privacy/"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://bunny.net/gdpr/sub-processors/"]')).toHaveCount(1);
  await expect(main.locator('a[href*="/wp-content/"]')).toHaveCount(0);
});

test("both privacy URLs render no obsolete CMS or plugin declaration", async ({
  page,
}) => {
  for (const pathname of ["/datenschutz/", "/datenschutzerklaerung/"]) {
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
    const mainText = await page.locator("main").innerText();

    expect(mainText).toContain("Hosting und Auslieferung über bunny.net");
    for (const term of removedLegacyTerms) {
      expect(mainText).not.toContain(term);
    }
    await expect(page.locator('main a[href*="/wp-content/"]')).toHaveCount(0);
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/datenschutz/",
  );
});

test("consent dialog names Bunny as the necessary hosting provider", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/datenschutz/`, { waitUntil: "domcontentloaded" });

  const consentText = await page.locator("[data-consent-dialog]").textContent();
  expect(consentText).toContain("globale Auslieferungsnetz von bunny.net");
  expect(consentText).toContain("bunny.net für Hosting, Auslieferung und Schutz");
  expect(consentText).not.toContain("Cloudflare für Auslieferung");
});
