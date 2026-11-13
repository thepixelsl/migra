import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });

async function openSecondPage(page: Page) {
  await page.goto(`${baseUrl}/posing-guide/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-posing-book]")).toHaveClass(/is-ready/);
  // Reach the sheet through the real navigation. This also finishes the initial
  // corner demonstration before measuring a user-controlled drag.
  await page.locator("[data-book-stage]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-book-status]")).toHaveText(/^Seite 2 von /);
  await expect(page.locator(".book-paper-overlay")).toHaveCount(0);
  await expect(page).toHaveURL(/#pose-001$/);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const sheet = document.querySelector<HTMLElement>("#pose-001")!;
    await Promise.all([...sheet.querySelectorAll("img")].map(image => image.decode()));
  });
}

async function holdCorner(page: Page, direction: "previous" | "next", distance: number) {
  const corner = page.locator(`[data-corner="top-${direction}"]`);
  await corner.evaluate(element => {
    const top = element.getBoundingClientRect().top;
    window.scrollTo({ top: window.scrollY + top - 48, behavior: "instant" });
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const box = (await corner.boundingBox())!;
  const stage = (await page.locator("[data-book-stage]").boundingBox())!;
  const x = direction === "previous" ? box.x + 3 : box.x + box.width - 3;
  await page.mouse.move(x, box.y + 3);
  await page.mouse.down();
  await expect(corner).toBeFocused();
  await expect(page.locator("[data-book-stage]")).toHaveAttribute("data-book-turning", "");
  await page.mouse.move(x + (direction === "previous" ? 1 : -1) * stage.width * distance, box.y + 120, { steps: 12 });
  // The geometry is drawn on requestAnimationFrame while the pointer is held.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function visibleFold(page: Page) {
  return page.locator(".book-paper-overlay").evaluate(overlay => {
    const sheets = [...overlay.querySelectorAll<HTMLElement>(".paper-face")]
      .map(element => ({
        element,
        style: getComputedStyle(element),
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ style, rect }) => style.display !== "none" && style.visibility !== "hidden"
        && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight)
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex));
    const folded = sheets[0];
    const underneath = sheets.find(sheet => Number(sheet.style.zIndex) < Number(folded.style.zIndex)
      && sheet.style.clipPath !== "none");
    return {
      folded: folded.element.querySelector(".book-page")?.getAttribute("aria-label"),
      underneath: underneath?.element.querySelector(".book-page")?.getAttribute("aria-label"),
      transform: folded.style.transform,
      clip: folded.style.clipPath,
      underneathClip: underneath?.style.clipPath,
    };
  });
}

test("mobile back folds the current sheet away and reveals the previous page", async ({ page }) => {
  await openSecondPage(page);
  const secondLabel = await page.locator("#pose-001").getAttribute("aria-label");
  const coverLabel = await page.locator("#titel").getAttribute("aria-label");

  await holdCorner(page, "previous", 0.62);
  const back = await visibleFold(page);
  expect(back.folded).toBe(secondLabel);
  expect(back.underneath).toBe(coverLabel);
  expect(back.transform).not.toBe("none");
  expect(back.clip).toMatch(/^polygon\(/);
  expect(back.underneathClip).toMatch(/^polygon\(/);
  await page.mouse.up();
  await expect(page.locator(".book-paper-overlay")).toHaveCount(0);
  await expect(page.locator("[data-book-status]")).toHaveText(/^Seite 1 von /);
  await expect(page).toHaveURL(/#titel$/);

  // The same visible-sheet/underneath relationship applies in the other direction.
  await holdCorner(page, "next", 0.62);
  const forward = await visibleFold(page);
  expect(forward.folded).toBe(coverLabel);
  expect(forward.underneath).toBe(secondLabel);
  await page.mouse.up();
  await expect(page.locator(".book-paper-overlay")).toHaveCount(0);
  await expect(page.locator("[data-book-status]")).toHaveText(/^Seite 2 von /);
  await expect(page).toHaveURL(/#pose-001$/);
});

test("releasing a short mobile back drag keeps the current page", async ({ page }) => {
  await openSecondPage(page);
  await holdCorner(page, "previous", 0.18);
  expect((await visibleFold(page)).folded).toBe(await page.locator("#pose-001").getAttribute("aria-label"));
  await page.mouse.up();
  await expect(page.locator(".book-paper-overlay")).toHaveCount(0);
  await expect(page.locator("[data-book-status]")).toHaveText(/^Seite 2 von /);
  await expect(page.locator("#pose-001")).toBeVisible();
  await expect(page).toHaveURL(/#pose-001$/);
});
