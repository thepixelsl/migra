import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("loads the featured portfolio image on touch tablets", async ({ browser }) => {
  for (const viewport of [
    { width: 810, height: 1080 },
    { width: 1080, height: 810 },
    { width: 1024, height: 768 },
    { width: 1280, height: 960 },
    { width: 1366, height: 1024 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "load" });

    const necessaryButton = page.getByRole("button", {
      name: "Nur notwendige",
      exact: true,
    }).first();
    if (await necessaryButton.isVisible()) await necessaryButton.click();

    const featuredBlock = page.locator("[data-featured-links]");
    const activeImage = featuredBlock.locator("[data-featured-media='0'] img");
    await featuredBlock.scrollIntoViewIfNeeded();
    await expect(featuredBlock.locator("[data-featured-link].hovered"))
      .toHaveAttribute("href", "/gallery-category/hochzeit/");
    await expect(activeImage).toBeVisible();
    await expect.poll(() => activeImage.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      currentSrc: image.currentSrc,
      naturalWidth: image.naturalWidth,
    }))).toMatchObject({
      complete: true,
      currentSrc: expect.not.stringMatching(/^data:/),
      naturalWidth: expect.any(Number),
    });
    expect(await activeImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await expect(activeImage).toHaveAttribute("src", /ART_4632/);

    const layout = await featuredBlock.evaluate((block) => {
      const imageWrap = block.querySelector<HTMLElement>(".flo-featured-links-1__image-wrap");
      const image = block.querySelector<HTMLImageElement>("[data-featured-media='0'] img");
      const imageBounds = image?.getBoundingClientRect();
      return {
        coarseTouch: matchMedia("(hover: none) and (pointer: coarse)").matches,
        imageWrapDisplay: imageWrap ? getComputedStyle(imageWrap).display : "none",
        imageWidth: Math.round(imageBounds?.width ?? 0),
        imageHeight: Math.round(imageBounds?.height ?? 0),
      };
    });
    expect(layout.coarseTouch).toBe(true);
    expect(layout.imageWrapDisplay).not.toBe("none");
    expect(layout.imageWidth).toBeGreaterThan(300);
    expect(layout.imageHeight).toBeGreaterThan(200);

    const blockBounds = await featuredBlock.boundingBox();
    expect(Math.abs(blockBounds!.x + blockBounds!.width / 2 - viewport.width / 2))
      .toBeLessThan(2);
    expect(blockBounds!.x).toBeGreaterThanOrEqual(40);

    // Focusing a gallery with a keyboard or attached trackpad must not swap
    // the tablet photograph or require a first tap merely to reveal a link.
    await featuredBlock.locator("[data-featured-link]").nth(3).focus();
    await expect(featuredBlock.locator("[data-featured-media].is-active"))
      .toHaveAttribute("data-featured-media", "0");
    const colors = await featuredBlock.locator("[data-featured-link]")
      .evaluateAll((links) => links.map((link) => getComputedStyle(link).color));
    expect(new Set(colors).size).toBe(1);

    for (const selector of [".planning-section", ".home-standesamt-feature",
      ".services-compass-section", ".home-editorial", ".social-section", ".contact-note"]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      const bounds = await section.boundingBox();
      expect(bounds!.x, selector).toBeGreaterThanOrEqual(40);
      expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2), selector)
        .toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width);

    await context.close();
  }
});
