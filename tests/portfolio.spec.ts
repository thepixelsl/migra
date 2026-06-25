import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-portfolio";

test("portfolio includes the Zurich article as a linked visual entry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/portfolio/`, { waitUntil: "domcontentloaded" });

  const zurichCard = page
    .locator("[data-portfolio-entry]")
    .filter({ has: page.getByRole("heading", { name: "Brautpaar in Zürich" }) });

  await expect(zurichCard).toBeVisible();
  await expect(zurichCard.getByRole("link", { name: "Brautpaar in Zürich ansehen" })).toHaveAttribute(
    "href",
    "/brautpaar-in-zuerich/",
  );
  await expect(zurichCard.locator("img")).toHaveAttribute(
    "alt",
    "Stephanie und Laurin beim eleganten Styled Elopement Fotoshooting in Zürich",
  );

  const state = await page.evaluate(() => {
    const schemas = [...document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    )].map((script) => JSON.parse(script.textContent ?? "{}"));
    const collectionSchema = schemas.find((schema) => schema["@type"] === "CollectionPage");
    const cards = [...document.querySelectorAll("[data-portfolio-entry]")];
    const firstLink = document.querySelector<HTMLAnchorElement>(
      "[data-portfolio-entry] .portfolio-overview-card__link",
    );

    return {
      firstHref: firstLink?.getAttribute("href"),
      missingAlt: [...document.querySelectorAll<HTMLImageElement>("[data-portfolio-entry] img")]
        .filter((image) => !image.alt).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      numberOfItems: collectionSchema?.mainEntity?.numberOfItems,
      hasZurichSchema: JSON.stringify(collectionSchema).includes("/brautpaar-in-zuerich/"),
      cardCount: cards.length,
    };
  });

  expect(state.firstHref).toBe("/brautpaar-in-zuerich/");
  expect(state.missingAlt).toBe(0);
  expect(state.overflow).toBe(0);
  expect(state.numberOfItems).toBe(state.cardCount);
  expect(state.hasZurichSchema).toBe(true);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop.png`,
    fullPage: false,
  });
});

test("mobile portfolio keeps the Zurich entry centered without horizontal drift", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/portfolio/`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Brautpaar in Zürich" })).toBeVisible();

  const mobileState = await page.evaluate(() => {
    const viewportCenter = document.documentElement.clientWidth / 2;
    const centerDelta = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return Math.round((bounds.left + bounds.width / 2) - viewportCenter);
    };

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      centers: {
        mobileBar: centerDelta(".mobile-navigation__bar"),
        portfolioGrid: centerDelta(".portfolio-overview-grid"),
      },
    };
  });

  expect(mobileState.overflow).toBe(0);
  expect(mobileState.centers.mobileBar).toBe(0);
  expect(mobileState.centers.portfolioGrid).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile.png`,
    fullPage: false,
  });
});
