import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const galleryCases = [
  {
    path: "/gallery/traumhochzeit-in-hamburg/",
    gallery: ".gallery-image-grid",
    items: ".gallery-image-grid__item",
    images: ".gallery-image-grid__item img",
    count: 28,
  },
  {
    path: "/location-scouting-in-paris/",
    gallery: ".migrated-gallery__grid",
    items: ".migrated-gallery__grid figure",
    images: ".migrated-gallery__grid figure img",
    count: 9,
  },
] as const;

const longGalleryCases = [
  {
    path: "/gallery/getting-ready-hamburg/",
    gallery: ".gallery-image-grid",
    items: ".gallery-image-grid__item",
    images: ".gallery-image-grid__item img",
    count: 84,
  },
  {
    path: "/gallery/jga-hamburg/",
    gallery: ".migrated-gallery__grid",
    items: ".migrated-gallery__grid figure",
    images: ".migrated-gallery__grid figure img",
    count: 157,
  },
] as const;

type GalleryCase = (typeof galleryCases)[number] | (typeof longGalleryCases)[number];

const readLayout = async (page: Page, example: GalleryCase) =>
  page.evaluate(({ gallerySelector, itemSelector }) => {
    const gallery = document.querySelector<HTMLElement>(gallerySelector)!;
    const galleryRect = gallery.getBoundingClientRect();

    return {
      columns: gallery.dataset.masonryColumns,
      gap: Number.parseFloat(getComputedStyle(gallery).columnGap),
      gallery: {
        left: galleryRect.left,
        top: galleryRect.top + window.scrollY,
        width: galleryRect.width,
        height: galleryRect.height,
      },
      items: [...document.querySelectorAll<HTMLElement>(itemSelector)].map((item) => {
        const rect = item.getBoundingClientRect();
        return {
          index: Number(item.dataset.galleryIndex),
          column: Number(item.dataset.masonryColumn),
          sourceWidth: Number(item.dataset.masonryWidth),
          sourceHeight: Number(item.dataset.masonryHeight),
          left: rect.left,
          top: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          transform: getComputedStyle(item).transform,
        };
      }),
    };
  }, { gallerySelector: example.gallery, itemSelector: example.items });

const expectShortestColumnMasonry = async (page: Page, example: GalleryCase) => {
  await expect(page.locator(example.items), example.path).toHaveCount(example.count);
  await expect.poll(
    () => page.locator(example.gallery).getAttribute("data-masonry-ready"),
    { message: example.path },
  ).toBe("true");

  const layout = await readLayout(page, example);
  expect(layout.columns, example.path).toBe("3");
  expect(layout.items.map(({ index }) => index), example.path).toEqual(
    Array.from({ length: example.count }, (_, index) => index),
  );

  const columnWidth = (layout.gallery.width - layout.gap * 2) / 3;
  const columnHeights = [0, 0, 0];

  layout.items.forEach((item) => {
    const shortestHeight = Math.min(...columnHeights);
    const column = columnHeights.findIndex((height) => height <= shortestHeight + 0.01);
    const expectedHeight = columnWidth * (item.sourceHeight / item.sourceWidth);
    const expectedLeft = layout.gallery.left + column * (columnWidth + layout.gap);
    const expectedTop = layout.gallery.top + columnHeights[column];

    expect(item.column, `${example.path} item ${item.index}`).toBe(column + 1);
    expect(item.width, `${example.path} item ${item.index} width`).toBeCloseTo(columnWidth, 0);
    expect(item.height, `${example.path} item ${item.index} height`).toBeCloseTo(expectedHeight, 0);
    expect(item.left, `${example.path} item ${item.index} left`).toBeCloseTo(expectedLeft, 0);
    expect(item.top, `${example.path} item ${item.index} top`).toBeCloseTo(expectedTop, 0);

    columnHeights[column] += expectedHeight + layout.gap;
  });

  expect(layout.gallery.height, `${example.path} gallery height`).toBeCloseTo(
    Math.max(...columnHeights) - layout.gap,
    0,
  );
};

test("reference and migrated galleries reproduce the Flothemes three-column masonry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const example of galleryCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
    await expectShortestColumnMasonry(page, example);

    const loading = await page.locator(example.images).evaluateAll((images) =>
      images.map((image: HTMLImageElement) => image.loading),
    );
    expect(loading, example.path).toContain("lazy");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, example.path).toBeLessThanOrEqual(1);
  }
});

test("gallery geometry remains fixed while long lazy-loaded galleries are scrolled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const example of longGalleryCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
    await expectShortestColumnMasonry(page, example);
    const before = await readLayout(page, example);

    const items = page.locator(example.items);
    for (let index = 0; index < example.count; index += 8) {
      await items.nth(index).scrollIntoViewIfNeeded();
    }
    await items.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const after = await readLayout(page, example);
    const maxDelta = Math.max(
      Math.abs(after.gallery.height - before.gallery.height),
      ...after.items.flatMap((item, index) => [
        Math.abs(item.left - before.items[index].left),
        Math.abs(item.top - before.items[index].top),
        Math.abs(item.width - before.items[index].width),
        Math.abs(item.height - before.items[index].height),
      ]),
    );
    expect(maxDelta, example.path).toBeLessThanOrEqual(1);
  }
});

test("the original 768 pixel breakpoint switches from three columns to one", async ({ page }) => {
  const example = galleryCases[0];

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
  await expectShortestColumnMasonry(page, example);

  await page.setViewportSize({ width: 767, height: 900 });
  await expect.poll(() => page.locator(example.gallery).getAttribute("data-masonry-columns")).toBe("1");
  const mobile = await readLayout(page, example);
  expect(mobile.gallery.left).toBeCloseTo(32, 0);
  expect(mobile.gallery.width).toBeCloseTo(703, 0);
  expect(mobile.gap).toBeCloseTo(30, 0);
  expect(mobile.items.every(({ left }) => Math.abs(left - mobile.gallery.left) <= 1)).toBe(true);
  expect(mobile.items.every(({ width }) => Math.abs(width - mobile.gallery.width) <= 1)).toBe(true);
  expect(mobile.items.every(({ transform }) => transform === "none")).toBe(true);
});

test("mobile galleries retain natural ratios, source order and 32 pixel side margins", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const example of galleryCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(example.items), example.path).toHaveCount(example.count);
    await expect.poll(() => page.locator(example.gallery).getAttribute("data-masonry-columns")).toBe("1");

    const layout = await readLayout(page, example);
    expect(layout.gallery.left, example.path).toBeCloseTo(32, 0);
    expect(layout.gallery.width, example.path).toBeCloseTo(326, 0);
    expect(layout.gap, example.path).toBeCloseTo(30, 0);
    expect(layout.items.map(({ index }) => index), example.path).toEqual(
      Array.from({ length: example.count }, (_, index) => index),
    );
    expect(layout.items.every(({ left }) => Math.abs(left - layout.gallery.left) <= 1)).toBe(true);
    expect(layout.items.every(({ width }) => Math.abs(width - layout.gallery.width) <= 1)).toBe(true);
    expect(layout.items.every(({ transform }) => transform === "none")).toBe(true);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, example.path).toBeLessThanOrEqual(1);
  }
});

test("Astro gallery images declare the equal-column responsive slot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/gallery/getting-ready-hamburg/`, {
    waitUntil: "domcontentloaded",
  });

  const sizes = await page.locator(".gallery-image-grid img").first().getAttribute("sizes");
  expect(sizes).toBe("(max-width: 767px) calc(100vw - 64px), 27.865vw");
});

test("Jahrhunderthalle keeps its curated 75-image WebP gallery and lightbox", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/gallery/hochzeit-jahrhunderhalle-bochum/`, {
    waitUntil: "domcontentloaded",
  });

  const excludedFiles = [
    "ART_1602", "ART_2214", "ART_0055", "ART_4608", "ART_5669",
    "ART_6761", "ART_6765", "ART_6771", "ART_6789", "ART_6838",
    "ART_0604", "ART_0659", "ART_0673", "ART_0805", "ART_0917",
    "ART_4201", "ART_4206", "ART_4210", "ART_4208", "ART_4940",
  ];
  const triggers = page.locator("[data-gallery-trigger='hochzeit-jahrhunderhalle-bochum']");
  await expect(triggers).toHaveCount(75);

  const fullSources = await triggers.evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.fullSrc ?? ""),
  );
  expect(fullSources.every((source) => source.endsWith(".webp"))).toBe(true);
  expect(excludedFiles.some((file) => fullSources.some((source) => source.includes(file)))).toBe(false);

  const schemaImages = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')]
      .flatMap((script) => {
        try {
          const node = JSON.parse(script.textContent ?? "null");
          return Array.isArray(node) ? node : [node];
        } catch {
          return [];
        }
      });
    const queue = [...nodes];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      if (node["@type"] === "ImageGallery") {
        return (node.image ?? []).map((image: { contentUrl?: string }) => image.contentUrl ?? "");
      }
      Object.values(node).forEach((value) => {
        if (Array.isArray(value)) queue.push(...value);
        else if (value && typeof value === "object") queue.push(value);
      });
    }
    return [];
  });
  expect(schemaImages).toHaveLength(75);
  expect(schemaImages.every((source) => source.endsWith(".webp"))).toBe(true);
  expect(excludedFiles.some((file) => schemaImages.some((source) => source.includes(file)))).toBe(false);

  await triggers.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-gallery-image]")).toHaveAttribute("src", /\.webp$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(triggers.first()).toBeFocused();
});
