import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-pricing-page";

mkdirSync(screenshotDirectory, { recursive: true });

test("pricing page renders with local links and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".pricing-hero h1")).toHaveText("Hochzeitsfotograf Hamburg Preise");
  await expect(page.locator("#pakete")).toBeVisible();
  await expect(page.locator("#faq")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const desktopFaqTypography = await page.locator(".pricing-faq__summary").first().evaluate((summary) => {
    const styles = getComputedStyle(summary);
    return {
      color: styles.color,
      fontSize: Number.parseFloat(styles.fontSize),
      fontWeight: styles.fontWeight,
      letterSpacing: Number.parseFloat(styles.letterSpacing),
      lineHeight: Number.parseFloat(styles.lineHeight),
    };
  });
  expect(desktopFaqTypography.color).toBe("rgb(64, 69, 77)");
  expect(desktopFaqTypography.fontSize).toBeCloseTo(21.375, 3);
  expect(desktopFaqTypography.fontWeight).toBe("400");
  expect(desktopFaqTypography.letterSpacing / desktopFaqTypography.fontSize).toBeCloseTo(0.03, 3);
  expect(desktopFaqTypography.lineHeight / desktopFaqTypography.fontSize).toBeCloseTo(1.375, 3);
  await expect(page.locator(".pricing-faq__content > .pricing-kicker")).toHaveCSS("font-size", "12px");
  const pricingPackages = page.locator(".pricing-package");
  await expect(pricingPackages).toHaveCount(3);
  expect(await pricingPackages.evaluateAll((items) => items.map((item) => item.id))).toEqual([
    "paket-pure-moments",
    "paket-standesamt-paket",
    "paket-rundum-sorglos-paket",
  ]);
  const pureMomentsPackage = page.locator("#paket-pure-moments");
  await expect(pureMomentsPackage).toContainText("Pure Moments");
  await expect(pureMomentsPackage.locator("li")).toHaveText([
    "1 Stunde fotografische Begleitung",
    "Persönliches Vorgespräch und Beratung",
    "Trauung, Brautpaarshooting, Gruppenfotos",
    "passwortgeschützte Onlinegallerie für 3 Monate",
    "mindestens 30 Bilder",
    "inklusive RAW-Bearbeitung für alle Bilder",
    "Retusche für ausgewählte Bilder",
    "keine Extra- oder versteckten Kosten (Festpreis)",
    "keine Fahrtkosten innerhalb Hamburgs",
    "nicht mit anderen Paketen kombinierbar",
  ]);
  await expect(
    pureMomentsPackage.getByText("1 Stunde fotografische Begleitung", { exact: true }),
  ).toHaveCount(1);

  const priceBox = await pureMomentsPackage.locator("h3").boundingBox();
  const firstFeatureBox = await pureMomentsPackage.locator("li").first().boundingBox();
  expect(priceBox).not.toBeNull();
  expect(firstFeatureBox).not.toBeNull();
  expect(firstFeatureBox!.y - (priceBox!.y + priceBox!.height)).toBeGreaterThanOrEqual(24);

  await expect(pureMomentsPackage).not.toContainText("kleine standesamtliche Hochzeit");
  await expect(page.getByText("Standesamt Paket", { exact: true })).toBeVisible();
  await expect(page.getByText("Rundum-Sorglos-Paket", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hochzeitsreportage in Hamburg 299 €" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Pure Moments 299 €" })).toBeVisible();
  await expect(page.locator("#pakete")).not.toContainText(/\bab\b/i);
  await expect(page.getByRole("article", { name: "Standesamt Paket 649 € Festpreis" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Rundum-Sorglos-Paket 249 € pro Stunde" })).toBeVisible();
  await expect(page.locator("#paket-vier-stunden-paket")).toHaveCount(0);
  await expect(page.locator("#paket-acht-stunden-paket")).toHaveCount(0);
  await expect(page.locator("#paket-ganztagspaket")).toHaveCount(0);

  await expect(page).toHaveTitle("Hochzeitsfotograf Hamburg Preise");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Preise und Pakete für Hochzeitsfotografie in Hamburg mit dem jeweils aufgeführten Leistungsumfang und Hinweisen zum individuellen Angebot.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/hochzeitsfotograf-preise/",
  );

  const schemaBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const schemaGraph = schemaBlocks
    .map((block) => JSON.parse(block))
    .find((block) => Array.isArray(block["@graph"]))?.["@graph"];
  expect(schemaGraph).toBeDefined();
  const serviceSchema = schemaGraph.find(
    (item: { [key: string]: unknown }) => item["@id"] === "https://artbild-fotografie.de/hochzeitsfotograf-preise/#service",
  );
  expect(serviceSchema.offers.itemListElement).toMatchObject([
    {
      "@id": "https://artbild-fotografie.de/hochzeitsfotograf-preise/#angebot-pure-moments",
      name: "Pure Moments",
      price: 299,
      position: 1,
      url: "https://artbild-fotografie.de/hochzeitsfotograf-preise/#paket-pure-moments",
    },
    {
      "@id": "https://artbild-fotografie.de/hochzeitsfotograf-preise/#angebot-standesamt-paket",
      name: "Standesamt Paket",
      price: 649,
      position: 2,
      url: "https://artbild-fotografie.de/hochzeitsfotograf-preise/#paket-standesamt-paket",
    },
    {
      "@id": "https://artbild-fotografie.de/hochzeitsfotograf-preise/#angebot-rundum-sorglos-paket",
      name: "Rundum-Sorglos-Paket",
      price: 249,
      position: 3,
      url: "https://artbild-fotografie.de/hochzeitsfotograf-preise/#paket-rundum-sorglos-paket",
    },
  ]);
  expect(schemaGraph.some((item: { [key: string]: unknown }) => item["@type"] === "FAQPage"))
    .toBe(false);
  expect(await page.locator("main").innerText()).not.toContain(
    "im Notfall eine geeignete Vertretung",
  );
  expect(await page.locator("main").innerText()).not.toContain(
    "Eine pauschale Reisekosten-Gebühr gibt es nicht",
  );

  const oldPriceLinks = await page.locator('a[href="https://artbild-fotografie.de/hochzeitsfotograf-preise/"]').count();
  expect(oldPriceLinks).toBe(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: false,
  });
});

test("pricing page is usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/hochzeitsfotograf-preise/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator(".pricing-hero h1")).toBeVisible();
  await expect(page.locator(".pricing-hero__actions a").first()).toBeVisible();
  await expect(page.locator(".pricing-package")).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const mobileFaqTypography = await page.locator(".pricing-faq__summary").first().evaluate((summary) => {
    const styles = getComputedStyle(summary);
    return {
      fontSize: Number.parseFloat(styles.fontSize),
      fontWeight: styles.fontWeight,
      letterSpacing: Number.parseFloat(styles.letterSpacing),
      lineHeight: Number.parseFloat(styles.lineHeight),
    };
  });
  expect(mobileFaqTypography.fontSize).toBe(19);
  expect(mobileFaqTypography.fontWeight).toBe("400");
  expect(mobileFaqTypography.letterSpacing / mobileFaqTypography.fontSize).toBeCloseTo(0.03, 3);
  expect(mobileFaqTypography.lineHeight / mobileFaqTypography.fontSize).toBeCloseTo(1.375, 3);

  const faqQuestionsFit = await page.locator(".pricing-faq__summary > span:nth-child(2)").evaluateAll(
    (questions) => questions.every((question) => question.scrollWidth <= question.clientWidth + 1),
  );
  expect(faqQuestionsFit).toBe(true);

  const packageBoxes = await page.locator(".pricing-package").evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }),
  );
  for (const box of packageBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
  }
  expect(packageBoxes[1].top).toBeGreaterThan(packageBoxes[0].bottom);
  expect(packageBoxes[2].top).toBeGreaterThan(packageBoxes[1].bottom);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
