import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const heroImageNames = [
  "cropped-hochzeitsreportage_hamburg_festpreis",
  "paris_braut_fotoshooting-17",
  "paris_braut_fotoshooting-25",
];

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});

test("mobile hero requests responsive modern images and only its immediate set", async ({ page }) => {
  const heroRequests = new Set<string>();
  const originalImageRequests = new Set<string>();

  page.on("response", (response) => {
    const url = response.url();
    const pathname = new URL(url).pathname;

    if (heroImageNames.some((name) => url.includes(name))) {
      heroRequests.add(url);
    }
    if (pathname.startsWith("/images/") && pathname.includes("paris_braut_fotoshooting")) {
      originalImageRequests.add(url);
    }
  });

  await page.goto(baseUrl, { waitUntil: "load" });

  const slider = page.locator(".hero-slider--mobile");
  const toggle = slider.locator("[data-slider-toggle]");
  await toggle.evaluate((button: HTMLButtonElement) => button.click());
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await expect
    .poll(() => slider.locator(".hero-slider__slide img[src], .hero-slider__slide img[srcset]").count())
    .toBe(3);

  const delivery = await slider.evaluate((element) => {
    const activeImage = element.querySelector<HTMLImageElement>(
      '.hero-slider__slide[aria-hidden="false"] img',
    );
    const loadedImages = Array.from(
      element.querySelectorAll<HTMLImageElement>("img[src], img[srcset]"),
    );
    const activeBounds = activeImage?.getBoundingClientRect();

    return {
      activeCurrentSrc: activeImage?.currentSrc ?? "",
      activeNaturalWidth: activeImage?.naturalWidth ?? 0,
      activeDisplayWidth: Math.round(activeBounds?.width ?? 0),
      activeDisplayHeight: Math.round(activeBounds?.height ?? 0),
      loadedCurrentSources: loadedImages.map((image) => image.currentSrc),
      deferredCount: element.querySelectorAll("img[data-src], img[data-srcset]").length,
    };
  });

  expect(delivery.activeCurrentSrc).toMatch(/(?:\.webp(?:$|\?)|[?&]f=webp(?:&|$))/);
  expect(delivery.activeCurrentSrc).not.toContain("/images/paris_braut_fotoshooting");
  expect(delivery.activeNaturalWidth).toBeGreaterThanOrEqual(delivery.activeDisplayWidth);
  expect(delivery.activeDisplayWidth).toBeGreaterThanOrEqual(138);
  expect(delivery.activeDisplayHeight).toBeGreaterThanOrEqual(232);
  expect(delivery.loadedCurrentSources).toHaveLength(3);
  expect(delivery.deferredCount).toBe(7);
  expect([...originalImageRequests]).toEqual([]);
  expect(heroRequests.size).toBeLessThanOrEqual(3);
});

test("percentage-based positioning keeps the hero centered and navigable", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "load" });

  const slider = page.locator(".hero-slider--mobile");
  const toggle = slider.locator("[data-slider-toggle]");
  const next = slider.locator("[data-slider-next]");

  await toggle.evaluate((button: HTMLButtonElement) => button.click());
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      slider.locator('.hero-slider__slide img[alt="Lachende Braut vor dem Eiffelturm"]')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);

  await next.evaluate((button: HTMLButtonElement) => button.click());
  await expect(
    slider.locator('.hero-slider__slide[aria-hidden="false"] img'),
  ).toHaveAttribute("alt", "Lachende Braut vor dem Eiffelturm");
  await expect
    .poll(() => slider.evaluate((element) => {
      const sliderBounds = element.getBoundingClientRect();
      const activeBounds = element
        .querySelector<HTMLElement>('.hero-slider__slide[aria-hidden="false"]')
        ?.getBoundingClientRect();

      if (!activeBounds) return Number.POSITIVE_INFINITY;
      const sliderCenter = sliderBounds.left + (sliderBounds.width / 2);
      const activeCenter = activeBounds.left + (activeBounds.width / 2);
      return Math.abs(sliderCenter - activeCenter);
    }))
    .toBeLessThan(1);

  const positions = await slider.evaluate((element) => {
    const sliderBounds = element.getBoundingClientRect();
    const active = element.querySelector<HTMLElement>(
      '.hero-slider__slide[aria-hidden="false"]',
    );
    const activeBounds = active?.getBoundingClientRect();
    const slides = Array.from(element.querySelectorAll<HTMLElement>(".hero-slider__slide"));

    return {
      sliderCenter: sliderBounds.left + (sliderBounds.width / 2),
      activeCenter: (activeBounds?.left ?? 0) + ((activeBounds?.width ?? 0) / 2),
      offsets: slides.map((slide) => slide.style.getPropertyValue("--offset-x")),
    };
  });

  expect(positions.activeCenter).toBeCloseTo(positions.sliderCenter, 1);
  expect(positions.offsets).toContain("0%");
  expect(positions.offsets).toContain("100%");
  expect(positions.offsets).toContain("-100%");
});
