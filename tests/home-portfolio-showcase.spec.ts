import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const showcaseLinks = [
  "/gallery/traumhochzeit-in-paris/",
  "/gallery/traumhochzeit-in-hamburg/",
  "/gallery/lovebirds-am-elbstrand/",
  "/gallery/hochzeit-braut-fotoshooting-hamburg/",
  "/gallery/braeutigam-im-barberhouse-hamburg/",
  "/gallery/floral-art/",
];

test("homepage combines both portfolio areas into one staggered desktop carousel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-portfolio-showcase-carousel]");
  const viewport = carousel.locator("[data-portfolio-showcase-viewport]");
  const cards = carousel.locator("[data-portfolio-showcase-card]");
  const previous = carousel.locator("[data-portfolio-showcase-previous]");
  const next = carousel.locator("[data-portfolio-showcase-next]");
  const status = carousel.locator("[data-portfolio-showcase-status]");

  await expect(page.locator(".related-section")).toHaveCount(0);
  await expect(page.locator(".mini-portfolio-section")).toHaveCount(0);
  await expect(page.locator("#portfolio-showcase-title")).toHaveText("Vielleicht gefällt Dir auch");
  await expect(carousel).toHaveCount(1);

  await carousel.scrollIntoViewIfNeeded();
  await expect(cards).toHaveCount(6);
  await expect(page.locator(".portfolio-showcase__link")).toHaveText("Sieh Dir mein Portfolio an.");

  for (const href of showcaseLinks) {
    await expect(carousel.locator(`a[href="${href}"]`)).toHaveCount(1);
  }

  await expect(previous).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  await expect(status).toHaveText("Arbeiten 1 bis 4 von 6");

  const desktopLayout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>("[data-portfolio-showcase-viewport]");
    const carouselCards = Array.from(element.querySelectorAll<HTMLElement>("[data-portfolio-showcase-card]"));
    const media = carouselCards.slice(0, 4).map((card) => {
      const bounds = card.querySelector<HTMLElement>(".portfolio-showcase__media")?.getBoundingClientRect();
      return {
        width: Math.round(bounds?.width ?? 0),
        height: Math.round(bounds?.height ?? 0),
      };
    });

    return {
      viewportWidth: Math.round(carouselViewport?.getBoundingClientRect().width ?? 0),
      cardWidths: carouselCards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().width)),
      categoryTops: carouselCards.slice(0, 4).map((card) =>
        Math.round(card.querySelector("p")?.getBoundingClientRect().top ?? 0)
      ),
      media,
      visibleStates: carouselCards.map((card) => card.getAttribute("aria-hidden")),
    };
  });

  expect(desktopLayout.viewportWidth).toBeGreaterThan(1200);
  expect(desktopLayout.cardWidths.every((width) => width >= 285 && width <= 305)).toBe(true);
  expect(desktopLayout.categoryTops[1]).toBeLessThan(desktopLayout.categoryTops[3]);
  expect(desktopLayout.categoryTops[3]).toBeLessThan(desktopLayout.categoryTops[0]);
  expect(desktopLayout.categoryTops[0]).toBeLessThan(desktopLayout.categoryTops[2]);
  expect(desktopLayout.media[0].width / desktopLayout.media[0].height).toBeCloseTo(2 / 3, 1);
  expect(desktopLayout.media[1].width / desktopLayout.media[1].height).toBeCloseTo(2 / 3, 1);
  expect(desktopLayout.media[2].width / desktopLayout.media[2].height).toBeCloseTo(3 / 2, 1);
  expect(desktopLayout.media[3].width / desktopLayout.media[3].height).toBeCloseTo(3 / 2, 1);
  expect(desktopLayout.visibleStates).toEqual(["false", "false", "false", "false", "true", "true"]);

  await next.click();
  await expect(status).toHaveText("Arbeiten 2 bis 5 von 6");
  await expect
    .poll(() => viewport.evaluate((element) => Math.round(element.scrollLeft)))
    .toBeGreaterThan(250);

  await next.click();
  await expect(status).toHaveText("Arbeiten 3 bis 6 von 6");
  await expect(next).toBeDisabled();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("portfolio carousel shows two cards and a subtle next-card preview on tablet", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-portfolio-showcase-carousel]");
  const cards = carousel.locator("[data-portfolio-showcase-card]");
  const next = carousel.locator("[data-portfolio-showcase-next]");
  const status = carousel.locator("[data-portfolio-showcase-status]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(status).toHaveText("Arbeiten 1 bis 2 von 6");
  await expect(next).toBeVisible();

  const tabletLayout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>("[data-portfolio-showcase-viewport]");
    const carouselCards = Array.from(element.querySelectorAll<HTMLElement>("[data-portfolio-showcase-card]"));
    const viewportWidth = carouselViewport?.getBoundingClientRect().width ?? 0;
    const cardWidth = carouselCards[0]?.getBoundingClientRect().width ?? 0;
    const step = carouselCards[1]?.offsetLeft - carouselCards[0]?.offsetLeft;
    return {
      viewportWidth: Math.round(viewportWidth),
      cardWidth: Math.round(cardWidth),
      nextPreview: Math.round(viewportWidth - step * 2),
      visibleStates: carouselCards.map((card) => card.getAttribute("aria-hidden")),
    };
  });

  expect(tabletLayout.cardWidth).toBeGreaterThan(300);
  expect(tabletLayout.cardWidth).toBeLessThan(tabletLayout.viewportWidth / 2);
  expect(tabletLayout.nextPreview).toBeGreaterThan(0);
  expect(tabletLayout.visibleStates).toEqual(["false", "false", "true", "true", "true", "true"]);

  await next.click();
  await expect(status).toHaveText("Arbeiten 2 bis 3 von 6");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("portfolio carousel remains swipeable, keyboard-operable and recognizable on iPhone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-portfolio-showcase-carousel]");
  const viewport = carousel.locator("[data-portfolio-showcase-viewport]");
  const next = carousel.locator("[data-portfolio-showcase-next]");
  const status = carousel.locator("[data-portfolio-showcase-status]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(status).toHaveText("Arbeit 1 von 6");
  await expect(next).toBeVisible();

  const mobileLayout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>("[data-portfolio-showcase-viewport]");
    const carouselCards = Array.from(element.querySelectorAll<HTMLElement>("[data-portfolio-showcase-card]"));
    const viewportWidth = carouselViewport?.getBoundingClientRect().width ?? 0;
    const cardWidth = carouselCards[0]?.getBoundingClientRect().width ?? 0;
    const step = carouselCards[1]?.offsetLeft - carouselCards[0]?.offsetLeft;
    return {
      viewportWidth: Math.round(viewportWidth),
      cardWidth: Math.round(cardWidth),
      nextPreview: Math.round(viewportWidth - step),
      visibleStates: carouselCards.map((card) => card.getAttribute("aria-hidden")),
    };
  });

  expect(mobileLayout.cardWidth).toBeGreaterThan(mobileLayout.viewportWidth * .84);
  expect(mobileLayout.cardWidth).toBeLessThan(mobileLayout.viewportWidth);
  expect(mobileLayout.nextPreview).toBeGreaterThan(10);
  expect(mobileLayout.visibleStates).toEqual(["false", "true", "true", "true", "true", "true"]);

  await next.click();
  await expect(status).toHaveText("Arbeit 2 von 6");
  await expect
    .poll(() => viewport.evaluate((element) => Math.round(element.scrollLeft)))
    .toBeGreaterThan(200);

  await viewport.focus();
  await viewport.press("ArrowRight");
  await expect(status).toHaveText("Arbeit 3 von 6");

  const controlGap = await carousel.evaluate((element) => {
    const activeCard = element.querySelectorAll<HTMLElement>("[data-portfolio-showcase-card]")[2];
    const controls = element.querySelector<HTMLElement>("[data-portfolio-showcase-controls]");
    return Math.round(
      (controls?.getBoundingClientRect().top ?? 0)
      - (activeCard?.getBoundingClientRect().bottom ?? 0),
    );
  });
  expect(controlGap).toBeGreaterThanOrEqual(20);
  expect(controlGap).toBeLessThanOrEqual(34);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
