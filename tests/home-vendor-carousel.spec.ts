import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4322";

const vendorLinks = [
  "https://www.instagram.com/katharina.seidl/",
  "https://foboxy.de/",
  "/gallery/ella-deck-couture/",
  "/gallery/visagistin-manja-biebow/",
  "/gallery/yildiz-duman-werner/",
];

test("vendor carousel preserves the former four-card spacing on desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-vendor-carousel]");
  const viewport = carousel.locator("[data-vendor-carousel-viewport]");
  const cards = carousel.locator("[data-vendor-carousel-card]");
  const previous = carousel.locator("[data-vendor-carousel-previous]");
  const next = carousel.locator("[data-vendor-carousel-next]");
  const current = carousel.locator("[data-vendor-carousel-current]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel).toHaveClass(/is-enhanced/);
  await expect(cards).toHaveCount(5);
  await expect(current).toHaveText("1–4");
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  for (const href of vendorLinks) {
    await expect(carousel.locator(`a[href="${href}"]`)).toHaveCount(1);
  }

  const initialLayout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>(
      "[data-vendor-carousel-viewport]",
    );
    const carouselCards = Array.from(
      element.querySelectorAll<HTMLElement>("[data-vendor-carousel-card]"),
    );
    const viewportWidth = carouselViewport?.getBoundingClientRect().width ?? 0;
    const cardWidth = carouselCards[0]?.getBoundingClientRect().width ?? 0;
    const step = carouselCards[1]?.offsetLeft - carouselCards[0]?.offsetLeft;

    return {
      viewportWidth,
      cardWidth,
      gap: step - cardWidth,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      visibleStates: carouselCards.map((card) =>
        card.getAttribute("aria-hidden"),
      ),
      hiddenLinkTabIndex:
        carouselCards[4]?.querySelector("a")?.getAttribute("tabindex"),
    };
  });

  expect(initialLayout.gap).toBeGreaterThanOrEqual(18);
  expect(initialLayout.gap).toBeLessThanOrEqual(30.5);
  expect(
    Math.abs(
      initialLayout.cardWidth -
        (initialLayout.viewportWidth - 3 * initialLayout.gap) / 4,
    ),
  ).toBeLessThan(1);
  expect(initialLayout.overflow).toBe(0);
  expect(initialLayout.visibleStates).toEqual([
    "false",
    "false",
    "false",
    "false",
    "true",
  ]);
  expect(initialLayout.hiddenLinkTabIndex).toBe("-1");

  await next.click();
  await expect(current).toHaveText("2–5");
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await expect(cards.nth(0)).toHaveAttribute("aria-hidden", "true");
  await expect(cards.nth(4)).toHaveAttribute("aria-hidden", "false");
  await expect(
    carousel.locator('a[href="/gallery/yildiz-duman-werner/"]'),
  ).not.toHaveAttribute("tabindex", "-1");
});

test("vendor directory and homepage reviews use clearly different visual treatments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const distinction = await page.evaluate(() => {
    const vendorSection = document.querySelector<HTMLElement>(".vendor-section");
    const vendorCard = document.querySelector<HTMLElement>("[data-vendor-carousel-card]");
    const vendorButton = document.querySelector<HTMLElement>("[data-vendor-carousel-next]");
    const reviewSection = document.querySelector<HTMLElement>("#home_review_lara_friedrichs");
    const reviewSlide = reviewSection?.querySelector<HTMLElement>(".editorial-review__slide");
    const reviewButton = reviewSection?.querySelector<HTMLElement>("[data-review-next]");

    const styles = (element: Element | null | undefined) =>
      element ? getComputedStyle(element) : null;
    const vendorSectionStyles = styles(vendorSection);
    const vendorCardStyles = styles(vendorCard);
    const vendorButtonStyles = styles(vendorButton);
    const reviewSectionStyles = styles(reviewSection);
    const reviewSlideStyles = styles(reviewSlide);
    const reviewButtonStyles = styles(reviewButton);

    return {
      vendorSectionBackground: vendorSectionStyles?.backgroundColor,
      reviewSectionBackground: reviewSectionStyles?.backgroundColor,
      vendorCardBackground: vendorCardStyles?.backgroundColor,
      reviewSlideBackground: reviewSlideStyles?.backgroundColor,
      reviewSlideShadow: reviewSlideStyles?.boxShadow,
      reviewSlideLeftBorder: reviewSlideStyles?.borderLeftColor,
      vendorControlRadius: vendorButtonStyles?.borderRadius,
      reviewControlRadius: reviewButtonStyles?.borderRadius,
    };
  });

  expect(distinction.vendorSectionBackground).not.toBe(
    distinction.reviewSectionBackground,
  );
  expect(distinction.vendorCardBackground).not.toBe(
    distinction.reviewSlideBackground,
  );
  expect(distinction.reviewSlideBackground).toBe("rgba(0, 0, 0, 0)");
  expect(distinction.reviewSlideShadow).toBe("none");
  expect(distinction.reviewSlideLeftBorder).not.toBe("rgba(0, 0, 0, 0)");
  expect(distinction.vendorControlRadius).toBe("50%");
  expect(distinction.reviewControlRadius).toBe("2px");
});

test("vendor carousel keeps two cards and the original gap on tablet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-vendor-carousel]");
  const cards = carousel.locator("[data-vendor-carousel-card]");
  const next = carousel.locator("[data-vendor-carousel-next]");
  const current = carousel.locator("[data-vendor-carousel-current]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(current).toHaveText("1–2");

  const layout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>(
      "[data-vendor-carousel-viewport]",
    );
    const carouselCards = Array.from(
      element.querySelectorAll<HTMLElement>("[data-vendor-carousel-card]"),
    );
    const viewportWidth = carouselViewport?.getBoundingClientRect().width ?? 0;
    const cardWidth = carouselCards[0]?.getBoundingClientRect().width ?? 0;
    const step = carouselCards[1]?.offsetLeft - carouselCards[0]?.offsetLeft;

    return {
      viewportWidth,
      cardWidth,
      gap: step - cardWidth,
      visibleStates: carouselCards.map((card) =>
        card.getAttribute("aria-hidden"),
      ),
    };
  });

  expect(layout.gap).toBeGreaterThanOrEqual(18);
  expect(layout.gap).toBeLessThanOrEqual(30.5);
  expect(
    Math.abs(layout.cardWidth - (layout.viewportWidth - layout.gap) / 2),
  ).toBeLessThan(1);
  expect(layout.visibleStates).toEqual([
    "false",
    "false",
    "true",
    "true",
    "true",
  ]);

  await next.click();
  await expect(current).toHaveText("2–3");
  await next.click();
  await next.click();
  await expect(current).toHaveText("4–5");
  await expect(next).toBeDisabled();
  await expect(cards.nth(4)).toHaveAttribute("aria-hidden", "false");
});

test("vendor carousel is swipeable and keyboard-operable on iPhone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-vendor-carousel]");
  const viewport = carousel.locator("[data-vendor-carousel-viewport]");
  const previous = carousel.locator("[data-vendor-carousel-previous]");
  const next = carousel.locator("[data-vendor-carousel-next]");
  const current = carousel.locator("[data-vendor-carousel-current]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(current).toHaveText("1");

  const mobileLayout = await carousel.evaluate((element) => {
    const carouselViewport = element.querySelector<HTMLElement>(
      "[data-vendor-carousel-viewport]",
    );
    const carouselCards = Array.from(
      element.querySelectorAll<HTMLElement>("[data-vendor-carousel-card]"),
    );
    const buttons = Array.from(
      element.querySelectorAll<HTMLElement>(".vendor-carousel__controls button"),
    );
    const cardWidth = carouselCards[0]?.getBoundingClientRect().width ?? 0;
    const viewportWidth = carouselViewport?.getBoundingClientRect().width ?? 0;
    const step = carouselCards[1]?.offsetLeft - carouselCards[0]?.offsetLeft;

    return {
      cardWidth,
      viewportWidth,
      gap: step - cardWidth,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      buttonSizes: buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    };
  });

  expect(Math.abs(mobileLayout.cardWidth - mobileLayout.viewportWidth)).toBeLessThan(1);
  expect(mobileLayout.gap).toBeGreaterThanOrEqual(18);
  expect(mobileLayout.gap).toBeLessThanOrEqual(18.5);
  expect(mobileLayout.overflow).toBe(0);
  expect(
    mobileLayout.buttonSizes.every(
      ({ width, height }) => width >= 44 && height >= 44,
    ),
  ).toBe(true);

  await viewport.focus();
  await viewport.press("ArrowRight");
  await expect(current).toHaveText("2");
  await expect(previous).toBeEnabled();

  await next.click();
  await expect(current).toHaveText("3");
  await expect(
    carousel.locator('a[href="/gallery/yildiz-duman-werner/"]'),
  ).toHaveAttribute("tabindex", "-1");
});
