import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-pricing-page";
mkdirSync(screenshotDirectory, { recursive: true });

test("pricing content and structured offers describe the same booking terms", async ({ page }) => {
  await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".pricing-hero h1")).toHaveText("Hochzeitsfotograf Hamburg Preise");
  await expect(page).toHaveTitle("Hochzeitsfotograf Hamburg Preise");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /3 Pakete ab 299.*1 Stunde/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /\bindex\b/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://artbild-fotografie.de/hochzeitsfotograf-preise/");
  await expect(page.getByRole("heading", { level: 2, name: "Pakete und Leistungen im Überblick" })).toBeVisible();

  const packageNames = ["Pure Moments", "Standesamt Paket", "Rundum-Sorglos-Paket"];
  const packages = page.locator(".pricing-package");
  await expect(packages).toHaveCount(3);
  await expect(packages.locator("h3")).toHaveText(packageNames);
  await expect(packages.locator(".pricing-package__price")).toHaveText(["299 €", "649 € Festpreis", "249 € pro Stunde"]);
  for (const item of await packages.all()) {
    await expect(item).toContainText("Passwortgeschützte Onlinegalerie für 3 Monate kostenlos");
    await expect(item.getByRole("link", { name: /unverbindlich anfragen/ })).toHaveAttribute("href", "/kontakt/");
  }
  await expect(page.locator("#paket-pure-moments")).not.toContainText("Kennenlernshooting");
  await expect(page.locator("#paket-standesamt-paket")).toContainText("Kennenlernshooting");
  await expect(page.locator("#paket-rundum-sorglos-paket")).toContainText("Kennenlernshooting");
  await expect(page.locator("#preisbeispiele")).toContainText("1.494");
  await expect(page.locator("#preisbeispiele")).toContainText("1.992");
  await expect(page.locator('#preisbeispiele a[href^="/gallery/"]')).toHaveCount(2);

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const graph = blocks.map(block => JSON.parse(block)).find(block => Array.isArray(block["@graph"]))?.["@graph"];
  expect(graph).toBeDefined();
  const service = graph.find((item: Record<string, unknown>) => item["@id"] === "https://artbild-fotografie.de/hochzeitsfotograf-preise/#service");
  const offers = service.hasOfferCatalog.itemListElement;
  expect(offers).toHaveLength(3);
  expect(offers.map((offer: { name: string }) => offer.name)).toEqual(packageNames);
  expect(offers[0]).toMatchObject({ price: 299, priceCurrency: "EUR" });
  expect(offers[1]).toMatchObject({ price: 649, priceCurrency: "EUR" });
  // An hourly rate must never be published as a complete package price.
  expect(offers[2]).not.toHaveProperty("price");
  expect(offers[2].priceSpecification).toMatchObject({
    "@type": "UnitPriceSpecification", price: 249, priceCurrency: "EUR", unitCode: "HUR",
    referenceQuantity: { value: 1, unitCode: "HUR" },
    eligibleQuantity: { minValue: 3, maxValue: 10, unitCode: "HUR" },
  });
  for (const offer of offers) {
    expect(offer.itemOffered.description).toContain("Onlinegalerie für 3 Monate kostenlos");
    await expect(page.locator(new URL(offer.url).hash)).toHaveCount(1);
  }
  expect(graph.some((item: Record<string, unknown>) => item["@type"] === "FAQPage")).toBe(false);
});

for (const width of [390, 810, 1440]) {
  test(`pricing navigation, images and FAQ work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("link", { name: "Pakete ansehen", exact: true }).click();
    await expect(page).toHaveURL(/#pakete$/);
    for (const image of await page.locator(".pricing-package img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    const box = await page.locator(".pricing").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(28);
    expect(Math.abs(box!.x - (width - box!.x - box!.width))).toBeLessThan(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    const calculator = page.locator("[data-pricing-calculator]");
    await expect(calculator).toBeVisible();
    for (let hours = 1; hours <= 10; hours++) {
      await calculator.getByLabel("Gesamte Begleitungsstunden").selectOption(String(hours));
      const expectedTotal = hours === 1 ? 299 : hours === 2 ? 649 : hours * 249;
      const expectedPackage = hours === 1 ? "pure-moments" : hours === 2 ? "standesamt-paket" : "rundum-sorglos-paket";
      await expect(calculator.locator("[data-calculator-total]")).toHaveText(new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(expectedTotal));
      await expect(calculator.locator("[data-calculator-package-link]")).toHaveAttribute("href", `#paket-${expectedPackage}`);
    }
    await calculator.getByLabel("Gesamte Begleitungsstunden").selectOption("6");
    await expect(calculator).toContainText("nicht die Anzahl der Tage");
    await expect(page.locator('[data-faq-id="preise_faq_19"] .pricing-faq__panel')).toContainText("1.743");
    const questionsFit = await page.locator(".pricing-faq__summary > span:nth-child(2)").evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth + 1));
    expect(questionsFit).toBe(true);
    const costFaq = page.locator('[data-faq-id="preise_faq_12"]');
    await costFaq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(costFaq.locator(".pricing-faq__panel")).toBeVisible();
    await expect(costFaq.locator(".pricing-faq__panel")).toContainText("1.494");
    const galleryFaq = page.locator('[data-faq-id="preise_faq_16"]');
    await galleryFaq.locator("summary").click();
    await expect(galleryFaq.locator(".pricing-faq__panel")).toContainText("3 Monate kostenlos verfügbar");
    await page.locator(".pricing-hero").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${screenshotDirectory}/${width}.png`, fullPage: false });
  });
}
