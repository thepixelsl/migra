import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("loads the featured portfolio image on touch tablets", async ({ browser }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 960 },
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
      .toHaveAttribute("href", "/gallery/paarshooting-mallorca/");
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
    await expect(activeImage).toHaveAttribute("src", /paarshooting-mallorca/);

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

    await context.close();
  }
});
