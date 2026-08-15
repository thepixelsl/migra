import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const requestedGalleries = [
  "/braut-fotoshooting-fraser-suites-hamburg/",
  "/gallery/traumhochzeit-in-hamburg/",
  "/brautpaar-in-zuerich/",
];

test("story carousel is visibly navigable and advances one card at a time on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-story-carousel]");
  const viewport = carousel.locator("[data-story-viewport]");
  const cards = carousel.locator("[data-story-card]");
  const previous = carousel.locator("[data-story-previous]");
  const next = carousel.locator("[data-story-next]");
  const status = carousel.locator("[data-story-status]");
  const controlLabel = carousel.locator(".story-carousel__control-label");

  await carousel.scrollIntoViewIfNeeded();
  await expect(cards).toHaveCount(6);
  await expect(cards.first()).toHaveRole("article");
  await expect(cards.first()).not.toHaveAttribute("role", "group");
  await expect(cards.first()).toHaveAttribute("aria-roledescription", "Folie");
  await expect(cards.first()).toHaveAccessibleName(/1 von 6: .+/);

  for (const href of requestedGalleries) {
    await expect(carousel.locator(`a[href="${href}"]`)).toHaveCount(1);
  }

  await expect(previous).toBeDisabled();
  await expect(previous).toBeVisible();
  await expect(next).toBeEnabled();
  await expect(next).toBeVisible();
  await expect(controlLabel).toHaveText("Galerien durchblättern");
  await expect(controlLabel).toBeHidden();
  await expect(carousel.locator("[data-story-pagination], [data-story-dot]")).toHaveCount(0);
  await expect(carousel.locator(".story-carousel__navigation > button")).toHaveCount(2);
  await expect(carousel.locator(".story-carousel__navigation > .story-carousel__position")).toHaveCount(1);
  await expect(carousel.locator("[data-story-current]")).toHaveText("1–4");
  await expect(status).toHaveText("Galerien 1 bis 4 von 6");

  const controlStyleParity = await page.evaluate(() => {
    const storyButton = document.querySelector<HTMLElement>("[data-story-previous]");
    const portfolioButton = document.querySelector<HTMLElement>("[data-portfolio-showcase-previous]");
    const storyNavigation = document.querySelector<HTMLElement>(".story-carousel__navigation");
    const vendorControls = document.querySelector<HTMLElement>(".vendor-carousel__controls");
    const storyPosition = document.querySelector<HTMLElement>(".story-carousel__position");
    const vendorPosition = document.querySelector<HTMLElement>(".vendor-carousel__position");
    const storyIcon = storyButton?.querySelector<SVGElement>("svg");
    const portfolioIcon = portfolioButton?.querySelector<SVGElement>("svg");
    const buttonProperties = [
      "width",
      "height",
      "borderWidth",
      "borderStyle",
      "borderColor",
      "borderRadius",
      "color",
      "opacity",
    ] as const;
    const iconProperties = ["width", "height", "strokeWidth"] as const;
    const positionProperties = [
      "minWidth",
      "color",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "textAlign",
    ] as const;

    const pickStyles = <T extends Element, K extends readonly (keyof CSSStyleDeclaration)[]>(
      element: T | null | undefined,
      properties: K,
    ) => {
      if (!element) return null;
      const styles = getComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [property, styles[property]]));
    };

    return {
      storyButton: pickStyles(storyButton, buttonProperties),
      portfolioButton: pickStyles(portfolioButton, buttonProperties),
      storyIcon: pickStyles(storyIcon, iconProperties),
      portfolioIcon: pickStyles(portfolioIcon, iconProperties),
      storyGap: getComputedStyle(storyNavigation!).gap,
      vendorGap: getComputedStyle(vendorControls!).gap,
      storyPosition: pickStyles(storyPosition, positionProperties),
      vendorPosition: pickStyles(vendorPosition, positionProperties),
    };
  });

  expect(controlStyleParity.storyButton).toEqual(controlStyleParity.portfolioButton);
  expect(controlStyleParity.storyIcon).toEqual(controlStyleParity.portfolioIcon);
  expect(controlStyleParity.storyGap).toBe(controlStyleParity.vendorGap);
  expect(controlStyleParity.storyPosition).toEqual(controlStyleParity.vendorPosition);

  const initialLayout = await carousel.evaluate((element) => {
    const storyViewport = element.querySelector<HTMLElement>("[data-story-viewport]");
    const storyCards = Array.from(element.querySelectorAll<HTMLElement>("[data-story-card]"));
    const mediaRatios = storyCards.slice(2, 4).map((card) => {
      const media = card.querySelector<HTMLElement>(".story-card__media");
      const bounds = media?.getBoundingClientRect();
      return (bounds?.width ?? 0) / (bounds?.height || 1);
    });
    return {
      viewportWidth: Math.round(storyViewport?.getBoundingClientRect().width ?? 0),
      cardWidths: storyCards.slice(0, 4).map((card) =>
        Math.round(card.getBoundingClientRect().width)
      ),
      mediaRatios,
      visibleStates: storyCards.map((card) => card.getAttribute("aria-hidden")),
    };
  });

  expect(initialLayout.viewportWidth).toBeGreaterThan(1200);
  expect(initialLayout.cardWidths.every((width) => width >= 265 && width <= 280)).toBe(true);
  expect(initialLayout.mediaRatios[0]).toBeCloseTo(2 / 3, 2);
  expect(initialLayout.mediaRatios[1]).toBeCloseTo(3 / 4, 2);
  expect(initialLayout.visibleStates).toEqual(["false", "false", "false", "false", "true", "true"]);

  await next.click();
  await expect(status).toHaveText("Galerien 2 bis 5 von 6");
  await expect(carousel.locator("[data-story-current]")).toHaveText("2–5");
  await expect(previous).toBeEnabled();
  await expect(next).toBeEnabled();
  await expect
    .poll(() => viewport.evaluate((element) => Math.round(element.scrollLeft)))
    .toBeGreaterThan(250);

  await next.click();
  await expect(status).toHaveText("Galerien 3 bis 6 von 6");
  await expect(carousel.locator("[data-story-current]")).toHaveText("3–6");
  await expect(next).toBeDisabled();

  const zurichImage = carousel.locator('a[href="/brautpaar-in-zuerich/"] img');
  await expect(zurichImage).toBeVisible();
  await expect(zurichImage).toHaveAttribute("src", /ART_8515-Bearbeitet-scaled/);
  await expect(zurichImage).toHaveCSS("object-fit", "contain");

  await previous.click();
  await expect(status).toHaveText("Galerien 2 bis 5 von 6");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("story carousel keeps its arrow-counter controls and two-card layout on tablet", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 820, height: 1080 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-story-carousel]");
  const cards = carousel.locator("[data-story-card]");
  const previous = carousel.locator("[data-story-previous]");
  const next = carousel.locator("[data-story-next]");
  const status = carousel.locator("[data-story-status]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(carousel.locator("[data-story-pagination], [data-story-dot]")).toHaveCount(0);
  await expect(carousel.locator("[data-story-current]")).toHaveText("1–2");
  await expect(status).toHaveText("Galerien 1 bis 2 von 6");

  const tabletLayout = await carousel.evaluate((element) => {
    const storyViewport = element.querySelector<HTMLElement>("[data-story-viewport]");
    const storyCards = Array.from(element.querySelectorAll<HTMLElement>("[data-story-card]"));
    const step = (storyCards[1]?.offsetLeft ?? 0) - (storyCards[0]?.offsetLeft ?? 0);
    const mediaRatios = storyCards.slice(2, 4).map((card) => {
      const media = card.querySelector<HTMLElement>(".story-card__media");
      const bounds = media?.getBoundingClientRect();
      return (bounds?.width ?? 0) / (bounds?.height || 1);
    });
    return {
      viewportWidth: Math.round(storyViewport?.getBoundingClientRect().width ?? 0),
      cardWidths: storyCards.slice(0, 2).map((card) =>
        Math.round(card.getBoundingClientRect().width)
      ),
      mediaRatios,
      nextCardPreview: Math.round((storyViewport?.getBoundingClientRect().width ?? 0) - (step * 2)),
      visibleStates: storyCards.map((card) => card.getAttribute("aria-hidden")),
    };
  });

  expect(tabletLayout.cardWidths.every((width) => width > 300)).toBe(true);
  expect(tabletLayout.cardWidths.every((width) => width < tabletLayout.viewportWidth / 2)).toBe(true);
  expect(tabletLayout.mediaRatios[0]).toBeCloseTo(2 / 3, 2);
  expect(tabletLayout.mediaRatios[1]).toBeCloseTo(3 / 4, 2);
  expect(tabletLayout.nextCardPreview).toBeGreaterThan(12);
  expect(tabletLayout.visibleStates).toEqual(["false", "false", "true", "true", "true", "true"]);

  await next.click();
  await expect(status).toHaveText("Galerien 2 bis 3 von 6");
  await expect(carousel.locator("[data-story-current]")).toHaveText("2–3");

  await next.click();
  await expect(status).toHaveText("Galerien 3 bis 4 von 6");
  await next.click();
  await expect(status).toHaveText("Galerien 4 bis 5 von 6");
  await next.click();
  await expect(status).toHaveText("Galerien 5 bis 6 von 6");
  await expect(carousel.locator("[data-story-current]")).toHaveText("5–6");
  await expect(next).toBeDisabled();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("story carousel places only arrows and counter between image and text on mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const carousel = page.locator("[data-story-carousel]");
  const viewport = carousel.locator("[data-story-viewport]");
  const previous = carousel.locator("[data-story-previous]");
  const next = carousel.locator("[data-story-next]");
  const status = carousel.locator("[data-story-status]");
  const current = carousel.locator("[data-story-current]");

  await carousel.scrollIntoViewIfNeeded();
  await expect(status).toHaveText("Galerie 1 von 6");
  await expect(current).toHaveText("1");
  await expect(previous).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  await expect(carousel.locator("[data-story-pagination], [data-story-dot]")).toHaveCount(0);
  await expect(carousel.locator("a button")).toHaveCount(0);

  const mobileLayout = await carousel.evaluate((element) => {
    const storyViewport = element.querySelector<HTMLElement>("[data-story-viewport]");
    const firstCard = element.querySelector<HTMLElement>("[data-story-card]");
    const firstImage = firstCard?.querySelector<HTMLElement>("img");
    const firstCopy = firstCard?.querySelector<HTMLElement>(".story-card__media + div");
    const storyToolbar = element.querySelector<HTMLElement>("[data-story-controls]");
    const previousButton = element.querySelector<HTMLElement>("[data-story-previous]");
    const nextButton = element.querySelector<HTMLElement>("[data-story-next]");
    const position = element.querySelector<HTMLElement>(".story-carousel__position");
    const imageBounds = firstImage?.getBoundingClientRect();
    const copyBounds = firstCopy?.getBoundingClientRect();
    const toolbarBounds = storyToolbar?.getBoundingClientRect();
    const previousBounds = previousButton?.getBoundingClientRect();
    const nextBounds = nextButton?.getBoundingClientRect();
    const positionBounds = position?.getBoundingClientRect();
    return {
      viewportWidth: Math.round(storyViewport?.getBoundingClientRect().width ?? 0),
      cardWidth: Math.round(firstCard?.getBoundingClientRect().width ?? 0),
      imageBottom: Math.round(imageBounds?.bottom ?? 0),
      toolbarTop: Math.round(toolbarBounds?.top ?? 0),
      toolbarBottom: Math.round(toolbarBounds?.bottom ?? 0),
      copyTop: Math.round(copyBounds?.top ?? 0),
      previousInsideToolbar:
        (previousBounds?.top ?? -1) >= (toolbarBounds?.top ?? 0)
        && (previousBounds?.bottom ?? 1) <= (toolbarBounds?.bottom ?? 0),
      nextInsideToolbar:
        (nextBounds?.top ?? -1) >= (toolbarBounds?.top ?? 0)
        && (nextBounds?.bottom ?? 1) <= (toolbarBounds?.bottom ?? 0),
      positionInsideToolbar:
        (positionBounds?.top ?? -1) >= (toolbarBounds?.top ?? 0)
        && (positionBounds?.bottom ?? 1) <= (toolbarBounds?.bottom ?? 0),
      previousCenter: Math.round((previousBounds?.left ?? 0) + ((previousBounds?.width ?? 0) / 2)),
      positionCenter: Math.round((positionBounds?.left ?? 0) + ((positionBounds?.width ?? 0) / 2)),
      nextCenter: Math.round((nextBounds?.left ?? 0) + ((nextBounds?.width ?? 0) / 2)),
    };
  });

  expect(mobileLayout.cardWidth).toBe(mobileLayout.viewportWidth);
  expect(mobileLayout.toolbarTop).toBeGreaterThan(mobileLayout.imageBottom);
  expect(mobileLayout.toolbarBottom).toBeLessThan(mobileLayout.copyTop);
  expect(mobileLayout.previousInsideToolbar).toBe(true);
  expect(mobileLayout.nextInsideToolbar).toBe(true);
  expect(mobileLayout.positionInsideToolbar).toBe(true);
  expect(mobileLayout.previousCenter).toBeLessThan(mobileLayout.positionCenter);
  expect(mobileLayout.positionCenter).toBeLessThan(mobileLayout.nextCenter);

  await next.click();
  await expect(status).toHaveText("Galerie 2 von 6");
  await expect(current).toHaveText("2");
  await expect
    .poll(() => viewport.evaluate((element) => Math.round(element.scrollLeft)))
    .toBeGreaterThan(300);

  await viewport.focus();
  await viewport.press("ArrowRight");
  await expect(status).toHaveText("Galerie 3 von 6");
  await expect(current).toHaveText("3");

  await viewport.press("ArrowRight");
  await expect(status).toHaveText("Galerie 4 von 6");
  await expect(current).toHaveText("4");

  await viewport.press("ArrowRight");
  await expect(status).toHaveText("Galerie 5 von 6");
  await viewport.press("ArrowRight");
  await expect(status).toHaveText("Galerie 6 von 6");
  await expect(current).toHaveText("6");

  const zurichImage = carousel.locator('a[href="/brautpaar-in-zuerich/"] img');
  await expect(zurichImage).toBeVisible();
  await expect(zurichImage).toHaveCSS("object-fit", "contain");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
