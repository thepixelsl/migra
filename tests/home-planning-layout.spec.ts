import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("planning intro leads into three prominent desktop cards", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const section = page.locator(".planning-section");
  const cards = section.locator(".planning-card");
  await section.scrollIntoViewIfNeeded();
  await expect(cards).toHaveCount(3);

  const layout = await section.evaluate((element) => {
    const intro = element.querySelector<HTMLElement>(".planning-section__intro");
    const heading = element.querySelector<HTMLElement>("#planning-title");
    const grid = element.querySelector<HTMLElement>(".planning-grid");
    const cardLinks = [...element.querySelectorAll<HTMLElement>(".planning-card > a")];
    if (!intro || !heading || !grid) return null;

    const sectionBounds = element.getBoundingClientRect();
    const introBounds = intro.getBoundingClientRect();
    const gridBounds = grid.getBoundingClientRect();

    return {
      headingOverflow: heading.scrollWidth - heading.clientWidth,
      introAboveGrid: introBounds.bottom <= gridBounds.top,
      gridWidthRatio: gridBounds.width / sectionBounds.width,
      gridColumns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      cards: cardLinks.map((card) => {
        const bounds = card.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.headingOverflow).toBeLessThanOrEqual(0);
  expect(layout!.introAboveGrid).toBe(true);
  expect(layout!.gridWidthRatio).toBeGreaterThanOrEqual(.88);
  expect(layout!.gridColumns).toBe(3);
  expect(layout!.cards.every(({ width }) => width >= 360)).toBe(true);
  expect(layout!.cards.every(({ width, height }) => height / width >= 1.95 && height / width <= 2.05)).toBe(true);
});

test("planning cards preserve their destinations, labels, and tracking", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const cards = page.locator(".planning-card > a");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("href", "/hochzeitsfotograf-preise/");
  await expect(cards.nth(1)).toHaveAttribute(
    "href",
    "/das-perfekte-getting-ready-fuer-deine-hochzeit-in-hamburg/",
  );
  await expect(cards.nth(2)).toHaveAttribute("href", "/trautermin-hamburg-online-reservieren/");

  for (let index = 0; index < 3; index += 1) {
    const card = cards.nth(index);
    await expect(card).toHaveAttribute("aria-label", /.+/);
    await expect(card).toHaveAttribute("data-track-event", "cta_click");
    await expect(card).toHaveAttribute("data-section-id", "home_planning_prices");
    await expect(card).toHaveAttribute("data-cta-id", /home_planning_.+/);
    await expect(card).toHaveAttribute("data-cta-type", /.+/);
    await expect(card).toHaveAttribute("data-content-topic", /.+/);
    await expect(card).toHaveAttribute("data-user-intent", /.+/);
    await expect(card).toHaveAttribute("data-journey-stage", /.+/);
    await expect(card).toHaveAttribute("data-position", `planning_card_${index + 1}`);
  }
});

test("price card uses the optimized high resolution image", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const image = page.locator(".planning-card--prices img");
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
    .toBe(true);

  const imageDetails = await image.evaluate((element: HTMLImageElement) => ({
    alt: element.alt,
    currentSrc: element.currentSrc,
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight,
    renderedWidth: element.getBoundingClientRect().width,
    renderedHeight: element.getBoundingClientRect().height,
  }));

  expect(imageDetails.alt).toContain("Hochzeitsfotograf Hamburg Preise");
  expect(imageDetails.currentSrc).not.toContain("/images/post-preise.jpg");
  expect(imageDetails.naturalWidth).toBeGreaterThanOrEqual(Math.floor(imageDetails.renderedWidth));
  expect(imageDetails.naturalHeight).toBeGreaterThanOrEqual(Math.floor(imageDetails.renderedHeight));
});

const viewports = [
  { width: 1440, height: 1000, mode: "desktop" },
  { width: 1180, height: 900, mode: "desktop" },
  { width: 1024, height: 900, mode: "desktop" },
  { width: 901, height: 900, mode: "desktop" },
  { width: 900, height: 900, mode: "tablet" },
  { width: 768, height: 1024, mode: "tablet" },
  { width: 621, height: 900, mode: "tablet" },
  { width: 620, height: 900, mode: "mobile" },
  { width: 390, height: 844, mode: "mobile" },
  { width: 320, height: 720, mode: "mobile" },
] as const;

for (const viewport of viewports) {
  test(`planning cards stay prominent and unclipped at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const section = page.locator(".planning-section");
    const links = section.locator(".planning-card > a");
    await section.scrollIntoViewIfNeeded();
    await expect(links).toHaveCount(3);
    await expect.poll(async () =>
      section.locator(".planning-card img").evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0)
      )
    ).toBe(true);

    const layout = await section.evaluate((element) => {
      const grid = element.querySelector<HTMLElement>(".planning-grid");
      const cards = [...element.querySelectorAll<HTMLElement>(".planning-card > a")];
      const textElements = [
        ...element.querySelectorAll<HTMLElement>(
          ".planning-card__kicker, .planning-card h3, .planning-card__summary",
        ),
      ];
      const textPanels = [...element.querySelectorAll<HTMLElement>(".planning-card__text")];
      const images = [...element.querySelectorAll<HTMLElement>(".planning-card img")];
      const gridBounds = grid?.getBoundingClientRect();

      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        gridColumns: grid
          ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length
          : 0,
        rowGap: grid ? Number.parseFloat(getComputedStyle(grid).rowGap) : 0,
        cardsInsideGrid: cards.every((card) => {
          const bounds = card.getBoundingClientRect();
          return Boolean(
            gridBounds
            && bounds.left >= gridBounds.left - 1
            && bounds.right <= gridBounds.right + 1
          );
        }),
        cardSizes: cards.map((card) => {
          const bounds = card.getBoundingClientRect();
          const style = getComputedStyle(card);
          return {
            width: bounds.width,
            height: bounds.height,
            radius: style.borderRadius,
            backgroundImage: style.backgroundImage,
          };
        }),
        textPanelBackgrounds: textPanels.map((panel) => getComputedStyle(panel).backgroundImage),
        clippedText: textElements.filter(
          (text) => text.scrollWidth > text.clientWidth + 1,
        ).length,
        clippedPanels: textPanels.filter(
          (panel) => panel.scrollWidth > panel.clientWidth + 1 || panel.scrollHeight > panel.clientHeight + 1,
        ).length,
        alternatingOrder: cards.map((card, index) => {
          const imageBounds = images[index]?.getBoundingClientRect();
          const textBounds = textPanels[index]?.getBoundingClientRect();
          if (!imageBounds || !textBounds) return false;
          const horizontal = Math.abs(imageBounds.top - textBounds.top) < 2;
          const imageFirst = horizontal
            ? imageBounds.left < textBounds.left
            : imageBounds.top < textBounds.top;
          return index === 1 ? !imageFirst : imageFirst;
        }),
      };
    });

    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
    expect(layout.gridColumns).toBe(viewport.mode === "desktop" ? 3 : 1);
    expect(layout.cardsInsideGrid).toBe(true);
    expect(layout.clippedText).toBe(0);
    expect(layout.clippedPanels).toBe(0);
    expect(layout.alternatingOrder.every(Boolean)).toBe(true);
    expect(layout.cardSizes.every(({ radius }) => radius === "0px")).toBe(true);
    expect(layout.cardSizes.every(({ backgroundImage }) => backgroundImage === "none")).toBe(true);
    expect(layout.textPanelBackgrounds.every((background) => background === "none")).toBe(true);

    if (viewport.mode === "desktop") {
      expect(layout.cardSizes.every(({ width, height }) => height / width >= 1.95 && height / width <= 2.05)).toBe(true);
    } else if (viewport.mode === "tablet") {
      expect(layout.cardSizes.every(({ width, height }) => width / height >= 1.95 && width / height <= 2.05)).toBe(true);
    } else {
      expect(layout.cardSizes.every(({ width, height }) => height / width >= 1.35)).toBe(true);
      expect(layout.rowGap).toBeGreaterThanOrEqual(26);
    }

    const firstLink = links.first();
    await firstLink.focus();
    const focusStyle = await firstLink.evaluate((link) => {
      const style = getComputedStyle(link);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
  });
}
