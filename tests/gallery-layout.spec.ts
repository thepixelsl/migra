import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const screenshotCases = [
  {
    path: "/trautermin-hamburg-online-reservieren/",
    gallery: ".gallery-image-grid",
    items: ".gallery-image-grid__item",
    images: ".gallery-image-grid__item img",
    count: 4,
  },
  {
    path: "/location-scouting-in-paris/",
    gallery: ".migrated-gallery > div",
    items: ".migrated-gallery figure",
    images: ".migrated-gallery figure img",
    count: 9,
  },
] as const;

const longGalleryCases = [
  {
    path: "/gallery/getting-ready-hamburg/",
    gallery: ".gallery-image-grid",
    items: ".gallery-image-grid__item",
    count: 84,
  },
  {
    path: "/gallery/jga-hamburg/",
    gallery: ".migrated-gallery > div",
    items: ".migrated-gallery figure",
    count: 157,
  },
] as const;

type Box = { left: number; top: number; width: number; height: number };

const readBoxes = async (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top + window.scrollY,
        width: box.width,
        height: box.height,
      };
    }),
  ) as Promise<Box[]>;

const groupRows = (boxes: Box[]) => {
  const rows: Box[][] = [];
  for (const box of boxes) {
    const row = rows.find((candidate) => Math.abs(candidate[0].top - box.top) <= 2);
    if (row) row.push(box);
    else rows.push([box]);
  }
  return rows;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

test("screenshot galleries form stable justified rows while images load lazily", async ({ page }) => {
  await page.setViewportSize({ width: 985, height: 640 });

  for (const example of screenshotCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });

    const gallery = page.locator(example.gallery);
    const items = page.locator(example.items);
    await expect(gallery, example.path).toHaveCSS("display", "flex");
    await expect(gallery, example.path).toHaveCSS("flex-wrap", "wrap");
    await expect(items, example.path).toHaveCount(example.count);

    const before = await readBoxes(page, example.items);
    expect(before.every(({ width, height }) => width > 0 && height > 0), example.path).toBe(true);

    const rows = groupRows(before);
    expect(rows.length, example.path).toBeGreaterThan(1);
    for (const row of rows) {
      const heights = row.map(({ height }) => height);
      expect(Math.max(...heights) - Math.min(...heights), example.path).toBeLessThanOrEqual(2);
    }

    const loading = await page.locator(example.images).evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).loading),
    );
    expect(loading, example.path).toContain("lazy");

    for (let index = 0; index < example.count; index += 2) {
      await items.nth(index).scrollIntoViewIfNeeded();
    }
    await items.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const after = await readBoxes(page, example.items);
    const maxDelta = Math.max(
      ...after.flatMap((box, index) =>
        (["left", "top", "width", "height"] as const).map((key) =>
          Math.abs(box[key] - before[index][key]),
        ),
      ),
    );
    expect(maxDelta, example.path).toBeLessThanOrEqual(2);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, example.path).toBeLessThanOrEqual(1);
  }
});

test("screenshot galleries use one full-width image per row on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const example of screenshotCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
    const boxes = await readBoxes(page, example.items);

    expect(boxes.every(({ width, height }) => width > 0 && height > 0), example.path).toBe(true);
    expect(new Set(boxes.map(({ left }) => Math.round(left))).size, example.path).toBe(1);
    expect(new Set(boxes.map(({ width }) => Math.round(width))).size, example.path).toBe(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, example.path).toBeLessThanOrEqual(1);
  }
});

test("long galleries fill complete rows without enlarging an incomplete final row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const example of longGalleryCases) {
    await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(example.items), example.path).toHaveCount(example.count);

    const galleryBox = await page.locator(example.gallery).evaluate((gallery) => {
      const box = gallery.getBoundingClientRect();
      return { left: box.left, right: box.right, bottom: box.bottom + window.scrollY };
    });
    const rows = groupRows(await readBoxes(page, example.items));
    expect(rows.length, example.path).toBeGreaterThan(1);

    for (const row of rows.slice(0, -1)) {
      const rowLeft = Math.min(...row.map(({ left }) => left));
      const rowRight = Math.max(...row.map(({ left, width }) => left + width));
      const heights = row.map(({ height }) => height);
      expect(Math.abs(rowLeft - galleryBox.left), example.path).toBeLessThanOrEqual(2);
      expect(Math.abs(rowRight - galleryBox.right), example.path).toBeLessThanOrEqual(2);
      expect(Math.max(...heights) - Math.min(...heights), example.path).toBeLessThanOrEqual(2);
    }

    const previousRowHeight = median(rows.slice(0, -1).map((row) => row[0].height));
    const finalRowHeight = Math.max(...rows.at(-1)!.map(({ height }) => height));
    expect(finalRowHeight / previousRowHeight, example.path).toBeLessThanOrEqual(1.5);
    const finalImageBottom = Math.max(
      ...rows.at(-1)!.map(({ top, height }) => top + height),
    );
    expect(
      Math.abs(galleryBox.bottom - finalImageBottom),
      `${example.path} has no empty filler row`,
    ).toBeLessThanOrEqual(2);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, example.path).toBeLessThanOrEqual(1);
  }
});

test("gallery density remains stable around the former 700 pixel breakpoint", async ({ page }) => {
  for (const example of [screenshotCases[0], screenshotCases[1], {
    path: "/gallery/getting-ready-hamburg/",
    gallery: ".gallery-image-grid",
  }] as const) {
    const heights: number[] = [];

    for (const width of [701, 700]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
      heights.push(await page.locator(example.gallery).evaluate(
        (gallery) => gallery.getBoundingClientRect().height,
      ));
    }

    const change = Math.max(...heights) / Math.min(...heights);
    expect(change, example.path).toBeLessThanOrEqual(1.25);
  }
});

test("narrow tablet galleries request a source large enough for wide images", async ({
  browser,
}) => {
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 621, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/gallery/getting-ready-hamburg/`, {
      waitUntil: "domcontentloaded",
    });

    const items = page.locator(".gallery-image-grid__item");
    const widestIndex = await items.evaluateAll((elements) =>
      elements
        .map((element, index) => ({ index, width: element.getBoundingClientRect().width }))
        .sort((left, right) => right.width - left.width)[0].index,
    );
    const image = items.nth(widestIndex).locator("img");
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(
      (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
    )).toBe(true);

    const source = await image.evaluate(async (element: HTMLImageElement) => {
      const rawImage = new Image();
      rawImage.src = element.currentSrc;
      await rawImage.decode();
      return {
        originalWidth: Number(element.getAttribute("width")),
        renderedWidth: element.getBoundingClientRect().width,
        resourceWidth: rawImage.naturalWidth,
        sizes: element.sizes,
      };
    });
    const requiredWidth = Math.min(
      source.originalWidth,
      source.renderedWidth * deviceScaleFactor,
    );
    expect(source.sizes).toContain("(max-width: 650px)");
    expect(source.resourceWidth, `${deviceScaleFactor}x source coverage`).toBeGreaterThanOrEqual(
      Math.floor(requiredWidth),
    );

    await context.close();
  }
});

test("tablet galleries keep multiple images in a row", async ({ page }) => {
  for (const width of [1024, 800]) {
    await page.setViewportSize({ width, height: 900 });

    for (const example of [longGalleryCases[1], {
      path: "/gallery/getting-ready-hamburg/",
      gallery: ".gallery-image-grid",
      items: ".gallery-image-grid__item",
      count: 84,
    }] as const) {
      await page.goto(`${baseUrl}${example.path}`, { waitUntil: "domcontentloaded" });
      const rows = groupRows(await readBoxes(page, example.items));
      expect(rows.some((row) => row.length >= 2), `${example.path} at ${width}px`).toBe(true);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${example.path} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
